'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createSession, destroySession, verifyPassword } from '../lib/auth';

export async function login(formData: FormData) {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect('/login?erro=credenciais');
  if (!process.env.DATABASE_URL) redirect('/login?erro=banco');
  let user;
  try {
    user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase().trim() } });
  } catch (error) {
    console.error('[auth] Falha ao consultar usuário no login.', error);
    redirect('/login?erro=banco');
  }
  if (!user || !user.active || !verifyPassword(parsed.data.password, user.passwordHash)) redirect('/login?erro=credenciais');
  await createSession(user.id);
  redirect('/');
}

export async function logout() {
  await destroySession();
  redirect('/login');
}
