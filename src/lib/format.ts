export function brDate(value: Date | string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

export function decimalToNumber(value: { toString(): string } | number) {
  return typeof value === 'number' ? value : Number(value.toString());
}

export function statusLabel(value: string) {
  return value.replaceAll('_', ' ');
}
