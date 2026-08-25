import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../../../../lib/prisma';

const itemSchema = z.object({
  product: z.string().trim().min(1),
  detail: z.string().trim().optional(),
  quantity: z.coerce.number().positive().default(1),
  unitOfMeasure: z.string().trim().min(1).default('un'),
});

const payloadSchema = z.object({
  messageId: z.string().trim().min(1),
  from: z.string().trim().email(),
  subject: z.string().trim().min(1),
  text: z.string().trim().optional().default(''),
  unitCode: z.string().trim().optional(),
  department: z.string().trim().optional(),
  urgency: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']).optional().default('MEDIA'),
  items: z.array(itemSchema).min(1).optional(),
});

async function nextRequestCode() {
  const year = new Date().getFullYear();
  const last = await prisma.purchaseRequest.findFirst({
    where: { year },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const lastNumber = last ? Number(last.code.split('-').at(-1)) || 0 : 0;
  return `SC-${year}-${String(lastNumber + 1).padStart(4, '0')}`;
}

function unauthorized() {
  return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.EMAIL_INGEST_SECRET;
  const auth = request.headers.get('authorization');
  if (!configuredSecret || auth !== `Bearer ${configuredSecret}`) return unauthorized();

  try {
    const payload = payloadSchema.parse(await request.json());
    const marker = `[email-message-id:${payload.messageId}]`;

    const duplicate = await prisma.purchaseRequest.findUnique({
      where: { emailMessageId: payload.messageId },
      select: { id: true, code: true, status: true },
    });
    if (duplicate) {
      return NextResponse.json({ ok: true, duplicate: true, request: duplicate });
    }

    const fallbackEmail = process.env.EMAIL_INGEST_FALLBACK_USER_EMAIL?.trim().toLowerCase();
    const senderEmail = payload.from.toLowerCase();

    const requester =
      (await prisma.user.findUnique({ where: { email: senderEmail } })) ??
      (fallbackEmail ? await prisma.user.findUnique({ where: { email: fallbackEmail } }) : null);

    if (!requester || !requester.active) {
      return NextResponse.json(
        {
          error: 'Remetente não cadastrado e nenhum usuário padrão válido foi configurado para a integração.',
          sender: senderEmail,
        },
        { status: 422 },
      );
    }

    const unit = payload.unitCode
      ? await prisma.unit.findUnique({ where: { code: payload.unitCode } })
      : requester.unitId
        ? await prisma.unit.findUnique({ where: { id: requester.unitId } })
        : null;

    if (!unit || !unit.active) {
      return NextResponse.json(
        { error: 'Não foi possível identificar uma unidade ativa para esta solicitação.' },
        { status: 422 },
      );
    }

    const department = payload.department
      ? await prisma.department.findUnique({
          where: { unitId_name: { unitId: unit.id, name: payload.department } },
        })
      : null;

    const items = payload.items ?? [
      {
        product: payload.subject,
        detail: payload.text || undefined,
        quantity: 1,
        unitOfMeasure: 'un',
      },
    ];

    const code = await nextRequestCode();
    const created = await prisma.purchaseRequest.create({
      data: {
        code,
        emailMessageId: payload.messageId,
        year: new Date().getFullYear(),
        unitId: unit.id,
        departmentId: department?.id ?? null,
        requesterId: requester.id,
        urgency: payload.urgency,
        description: payload.subject,
        justification: payload.text || null,
        notes: [
          'Origem: E-mail',
          'Situação de entrada: Aguardando conferência',
          `Remetente original: ${payload.from}`,
          marker,
        ].join('\n'),
        status: 'NOVA',
        items: {
          create: items.map(item => ({
            product: item.product,
            detail: item.detail || null,
            quantity: item.quantity,
            unitOfMeasure: item.unitOfMeasure,
          })),
        },
      },
      select: {
        id: true,
        code: true,
        status: true,
        unitId: true,
        requesterId: true,
      },
    });

    return NextResponse.json({ ok: true, duplicate: false, request: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload inválido.', details: error.flatten() }, { status: 400 });
    }
    console.error('EMAIL_INGEST_ERROR', error);
    return NextResponse.json({ error: 'Falha ao criar solicitação a partir do e-mail.' }, { status: 500 });
  }
}
