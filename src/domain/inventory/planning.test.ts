import { describe, expect, it } from 'vitest';
import { calculateInventoryPlan } from './planning';

describe('planejamento de estoque', () => {
  const now = new Date('2026-08-12T12:00:00');

  it('manda repor quando saldo atinge consumo do lead time + segurança', () => {
    const plan = calculateInventoryPlan({ currentStock: 8, minimumStock: 2, estimatedDailyConsumption: 1, leadTimeDays: 5, safetyDays: 3, now });
    expect(plan.reorderPoint).toBe(8);
    expect(plan.status).toBe('REPOR_AGORA');
  });

  it('não deixa uma única saída substituir a estimativa manual', () => {
    const plan = calculateInventoryPlan({
      currentStock: 15, minimumStock: 3, targetStock: 30, estimatedDailyConsumption: 1, leadTimeDays: 7, safetyDays: 3, now,
      consumptions: [{ quantity: 5, occurredAt: new Date('2026-08-12T10:00:00') }],
    });
    expect(plan.consumptionSource).toBe('Estimativa · histórico insuficiente');
    expect(plan.dailyConsumption).toBe(1);
    expect(plan.reorderPoint).toBe(10);
    expect(plan.coverageDays).toBe(15);
    expect(plan.status).toBe('ATENCAO');
  });

  it('mistura estimativa e histórico enquanto a base está em formação', () => {
    const plan = calculateInventoryPlan({
      currentStock: 20, minimumStock: 2, estimatedDailyConsumption: 1, leadTimeDays: 3, safetyDays: 2, now,
      consumptions: [
        { quantity: 2, occurredAt: new Date('2026-08-05T12:00:00') },
        { quantity: 2, occurredAt: new Date('2026-08-08T12:00:00') },
        { quantity: 2, occurredAt: new Date('2026-08-11T12:00:00') },
      ],
    });
    expect(plan.consumptionSource).toBe('Histórico em formação · estimativa + real');
    expect(plan.dailyConsumption).toBeCloseTo(0.875, 3);
  });

  it('usa histórico consolidado após período e amostra mínimos', () => {
    const plan = calculateInventoryPlan({
      currentStock: 20, minimumStock: 2, estimatedDailyConsumption: 1, leadTimeDays: 3, safetyDays: 2, now,
      consumptions: [
        { quantity: 4, occurredAt: new Date('2026-07-28T12:00:00') },
        { quantity: 4, occurredAt: new Date('2026-08-01T12:00:00') },
        { quantity: 4, occurredAt: new Date('2026-08-04T12:00:00') },
        { quantity: 4, occurredAt: new Date('2026-08-07T12:00:00') },
        { quantity: 4, occurredAt: new Date('2026-08-11T12:00:00') },
      ],
    });
    expect(plan.consumptionSource).toBe('Histórico consolidado · 30d');
    expect(plan.dailyConsumption).toBeCloseTo(1.25, 5);
    expect(plan.reorderPoint).toBeCloseTo(6.25, 5);
  });

  it('calcula quantidade sugerida até o estoque alvo', () => {
    const plan = calculateInventoryPlan({ currentStock: 3, minimumStock: 2, targetStock: 15, estimatedDailyConsumption: 1, leadTimeDays: 5, safetyDays: 2, now });
    expect(plan.suggestedQuantity).toBe(12);
  });

  it('mantém estimativa com histórico curto', () => {
    const now = new Date('2026-08-13T12:00:00');
    const plan = calculateInventoryPlan({
      currentStock: 15,
      minimumStock: 3,
      targetStock: 30,
      estimatedDailyConsumption: 1,
      leadTimeDays: 7,
      safetyDays: 3,
      now,
      consumptions: [
        { quantity: 5, occurredAt: new Date('2026-08-12T12:00:00') },
      ],
    });
    expect(plan.dailyConsumption).toBe(1);
    expect(plan.consumptionSource).toContain('histórico insuficiente');
    expect(plan.reorderPoint).toBe(10);
  });

  it('histórico consolidado assume a previsão após base suficiente', () => {
    const now = new Date('2026-08-20T12:00:00');
    const plan = calculateInventoryPlan({
      currentStock: 20,
      minimumStock: 3,
      estimatedDailyConsumption: 1,
      leadTimeDays: 7,
      safetyDays: 3,
      now,
      consumptions: [
        { quantity: 2, occurredAt: new Date('2026-08-05T12:00:00') },
        { quantity: 2, occurredAt: new Date('2026-08-08T12:00:00') },
        { quantity: 2, occurredAt: new Date('2026-08-11T12:00:00') },
        { quantity: 2, occurredAt: new Date('2026-08-14T12:00:00') },
        { quantity: 2, occurredAt: new Date('2026-08-17T12:00:00') },
      ],
    });
    expect(plan.sampleCount).toBe(5);
    expect(plan.observedDays).toBeGreaterThanOrEqual(14);
    expect(plan.consumptionSource).toContain('Histórico consolidado');
  });
});
