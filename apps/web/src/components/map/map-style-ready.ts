import type { Map } from "maplibre-gl";

/** O estilo pode receber camadas enquanto tiles/fontes ainda estão carregando. */
export function applyToMapStyle(map: Pick<Map, "getStyle" | "once" | "off">, apply: () => void) {
  let cancelled = false;
  const run = () => {
    if (!cancelled) apply();
  };
  if (map.getStyle()) run();
  else map.once("style.load", run);
  return () => {
    cancelled = true;
    map.off("style.load", run);
  };
}
