import 'server-only';
import { createHash, randomBytes } from 'crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from './prisma';

export const SESSION_COOKIE = 'brasauto_session';
const SESSION_DAYS = 8;
const SESSION_RETRIES = 3;
const SESSION_RETRY_DELAY_MS = 350;
const SESSION_CACHE_TTL_MS = 60_000;

type CachedSession = {
  value: Awaited<ReturnType<typeof querySession>>;
  expiresAt: number;
};

const globalSessionCache = globalThis as unknown as {
  brasautoSessionCache?: Map<string, CachedSession>;
};

function sessionCache() {
  return globalSessionCache.brasautoSessionCache ??= new Map<string, CachedSession>();
}

export { hashPassword, verifyPassword } from './password';
import { verifyPassword } from './password';

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { userId, tokenHash: tokenHash(token), expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const hashed = tokenHash(token);
    sessionCache().delete(hashed);
    await prisma.session.deleteMany({ where: { tokenHash: hashed } }).catch(() => undefined);
  }
  store.delete(SESSION_COOKIE);
}

async function querySession(hashedToken: string) {
  const startedAt = Date.now();
  const result = await prisma.session.findUnique({
    relationLoadStrategy: 'join',
    where: { tokenHash: hashedToken },
    include: {
      user: {
        include: {
          unit: true,
          roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        },
      },
    },
  });
  if (process.env.NODE_ENV !== 'production') console.log(`[perf] auth:session-db: ${Date.now() - startedAt}ms`);
  return result;
}

async function readSessionWithRetry(hashedToken: string) {
  const cache = sessionCache();
  const cached = cache.get(hashedToken);
  if (cached && cached.expiresAt > Date.now()) {
    if (process.env.NODE_ENV !== 'production') console.log('[perf] auth:session-cache: 0ms');
    return cached.value;
  }
  if (cached) cache.delete(hashedToken);

  let lastError: unknown;
  for (let attempt = 1; attempt <= SESSION_RETRIES; attempt += 1) {
    try {
      const result = await querySession(hashedToken);
      cache.set(hashedToken, { value: result, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
      return result;
    } catch (error) {
      lastError = error;
      console.error(`[auth] Falha ao consultar sessão (${attempt}/${SESSION_RETRIES}).`);
      if (attempt < SESSION_RETRIES) await wait(SESSION_RETRY_DELAY_MS * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Falha ao consultar a sessão no banco de dados.');
}

const getCurrentUserCached = cache(async () => {
  if (!process.env.DATABASE_URL) return null;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await readSessionWithRetry(tokenHash(token));
  if (!session || session.expiresAt <= new Date() || !session.user.active) return null;

  const permissions = new Set(session.user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.key)));
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    unitId: session.user.unitId,
    unitName: session.user.unit?.name ?? null,
    roles: session.user.roles.map(ur => ur.role.name),
    permissions,
  };
});


export async function getCurrentUser() {
  return getCurrentUserCached();
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?erro=sessao');
  return user;
}

export async function requirePermission(permission: string) {
  const user = await requireUser();
  if (!user.permissions.has(permission) && !user.permissions.has('ADMIN_ALL')) redirect('/sem-permissao');
  return user;
}

export async function audit(userId: string, entity: string, recordId: string, newValue: unknown, oldValue?: unknown, unitId?: string | null, field?: string) {
  await prisma.auditLog.create({
    data: {
      userId,
      unitId: unitId ?? null,
      entity,
      recordId,
      field: field ?? null,
      oldValue: oldValue === undefined ? undefined : JSON.parse(JSON.stringify(oldValue)),
      newValue: JSON.parse(JSON.stringify(newValue)),
    },
  });
}
