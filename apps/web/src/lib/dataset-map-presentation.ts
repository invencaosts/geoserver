const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 8 });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

export function isEmptyDatasetValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function datasetFieldLabel(key: string): string {
  const label = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : key;
}

export function formatDatasetValue(value: unknown): string {
  if (typeof value === "number")
    return Number.isFinite(value) ? numberFormatter.format(value) : "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "string") {
    // Só datas ISO inequívocas: códigos e números em texto mantêm zeros à esquerda.
    if (/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return dateFormatter.format(date);
    }
    return value;
  }
  return JSON.stringify(value) ?? String(value);
}

const COLORS = ["#087f8c", "#ad531b", "#7651b0", "#38783d", "#b43b65", "#386cb0", "#8b6d1f"];

export function datasetColor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return COLORS[(hash >>> 0) % COLORS.length];
}

/** Nunca envia o bearer para tiles externos ou URLs com prefixos parecidos. */
export function isDatasetTileUrl(url: string, apiUrl: string): boolean {
  try {
    const base = new URL(apiUrl, "http://localhost");
    const tile = new URL(url, base);
    const prefix = base.pathname.replace(/\/$/, "");
    return (
      tile.origin === base.origin &&
      new RegExp(
        `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/datasets/[^/]+/tiles/\\d+/\\d+/\\d+\\.mvt$`,
      ).test(tile.pathname)
    );
  } catch {
    return false;
  }
}
