export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeCpfOrCnpj(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeOptionalEmail(value?: string | null) {
  return value == null ? value : normalizeEmail(value);
}

export function normalizeOptionalCpfOrCnpj(value?: string | null) {
  return value == null ? value : normalizeCpfOrCnpj(value);
}

export function normalizeOptionalText(value?: string | null) {
  if (value == null) return value;
  return value.trim() || null;
}
