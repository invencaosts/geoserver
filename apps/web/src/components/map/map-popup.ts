import type { Map, Popup } from "maplibre-gl";

const popups = new WeakMap<Map, Popup>();

/** Casos e datasets compartilham um popup; remove também listeners da instância anterior. */
export function replaceMapPopup(map: Map, popup: Popup): Popup {
  popups.get(map)?.remove();
  popups.set(map, popup);
  popup.on("close", () => {
    if (popups.get(map) === popup) popups.delete(map);
  });
  return popup;
}
