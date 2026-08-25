export type ConsumptionSample = { quantity: number; occurredAt: Date };

export type InventoryPlanInput = {
  currentStock: number;
  minimumStock: number;
  targetStock?: number | null;
  estimatedDailyConsumption?: number | null;
  leadTimeDays: number;
  safetyDays: number;
  consumptions?: ConsumptionSample[];
  now?: Date;
};

export type InventoryStatus = 'CRITICO' | 'REPOR_AGORA' | 'ATENCAO' | 'OK' | 'SEM_BASE';

const MS_PER_DAY = 86400000;
const FORMING_MIN_DAYS = 7;
const FORMING_MIN_SAMPLES = 3;
const CONSOLIDATED_MIN_DAYS = 14;
const CONSOLIDATED_MIN_SAMPLES = 5;

export function calculateInventoryPlan(input: InventoryPlanInput) {
  const now = input.now ?? new Date();
  const samples = [...(input.consumptions ?? [])]
    .filter(s => s.quantity > 0)
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  const consumed = samples.reduce((sum, s) => sum + s.quantity, 0);
  let observedDays = 0;
  let historicalDaily = 0;

  if (consumed > 0 && samples.length) {
    observedDays = Math.max(
      1,
      Math.min(30, Math.ceil((now.getTime() - samples[0].occurredAt.getTime()) / MS_PER_DAY) + 1),
    );
    historicalDaily = consumed / observedDays;
  }

  const estimated = Math.max(0, input.estimatedDailyConsumption ?? 0);
  const hasFormingHistory = observedDays >= FORMING_MIN_DAYS && samples.length >= FORMING_MIN_SAMPLES;
  const hasConsolidatedHistory = observedDays >= CONSOLIDATED_MIN_DAYS && samples.length >= CONSOLIDATED_MIN_SAMPLES;

  let dailyConsumption = 0;
  let consumptionSource = 'Sem base';

  if (hasConsolidatedHistory && historicalDaily > 0) {
    dailyConsumption = historicalDaily;
    consumptionSource = 'Histórico consolidado · 30d';
  } else if (hasFormingHistory && historicalDaily > 0 && estimated > 0) {
    // Enquanto o histórico ainda está amadurecendo, evita que poucos lançamentos
    // provoquem alertas falsos. A referência real entra gradualmente.
    dailyConsumption = (estimated + historicalDaily) / 2;
    consumptionSource = 'Histórico em formação · estimativa + real';
  } else if (estimated > 0) {
    dailyConsumption = estimated;
    consumptionSource = samples.length > 0 ? 'Estimativa · histórico insuficiente' : 'Estimativa';
  } else if (hasFormingHistory && historicalDaily > 0) {
    dailyConsumption = historicalDaily;
    consumptionSource = hasConsolidatedHistory ? 'Histórico consolidado · 30d' : 'Histórico em formação · real';
  }

  const computedReorderPoint = dailyConsumption * Math.max(0, input.leadTimeDays + input.safetyDays);
  const reorderPoint = Math.max(Math.max(0, input.minimumStock), computedReorderPoint);
  const defaultTarget = dailyConsumption > 0
    ? dailyConsumption * (Math.max(0, input.leadTimeDays + input.safetyDays) + 30)
    : Math.max(0, input.minimumStock) * 2;
  const target = input.targetStock != null ? Math.max(0, input.targetStock) : Math.max(reorderPoint, defaultTarget);
  const stock = Math.max(0, input.currentStock);
  const coverageDays = dailyConsumption > 0 ? stock / dailyConsumption : null;
  const daysUntilReorder = dailyConsumption > 0 ? Math.max(0, (stock - reorderPoint) / dailyConsumption) : null;
  const suggestedQuantity = Math.max(0, target - stock);
  const nextPurchaseDate = daysUntilReorder == null ? null : new Date(now.getTime() + Math.floor(daysUntilReorder) * MS_PER_DAY);

  let status: InventoryStatus = 'OK';
  if (stock <= input.minimumStock) status = 'CRITICO';
  else if (stock <= reorderPoint) status = 'REPOR_AGORA';
  else if (daysUntilReorder != null && daysUntilReorder <= 7) status = 'ATENCAO';
  else if (dailyConsumption <= 0) status = 'SEM_BASE';

  return {
    historicalDaily,
    observedDays,
    sampleCount: samples.length,
    dailyConsumption,
    consumptionSource,
    reorderPoint,
    target,
    coverageDays,
    daysUntilReorder,
    suggestedQuantity,
    nextPurchaseDate,
    status,
  };
}
