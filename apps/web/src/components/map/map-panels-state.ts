export const MAP_PANEL_IDS = ["cases", "data", "search"] as const;
export type MapPanelId = (typeof MAP_PANEL_IDS)[number];
export type MapPanelVisibility = Record<MapPanelId, boolean>;
export interface MapPanelsState {
  collapsed: MapPanelVisibility;
  restore: MapPanelVisibility | null;
}
export const initialMapPanelsState: MapPanelsState = {
  collapsed: { cases: false, data: false, search: false },
  restore: null,
};
export type MapPanelsAction =
  { type: "toggle"; panel: MapPanelId } | { type: "toggleAll" } | { type: "initialMobile" };

/** Visibilidade é independente dos dados/filtros internos dos painéis. */
export function mapPanelsReducer(state: MapPanelsState, action: MapPanelsAction): MapPanelsState {
  if (action.type === "initialMobile") {
    return { collapsed: { cases: true, data: true, search: true }, restore: null };
  }
  if (action.type === "toggle") {
    return {
      ...state,
      collapsed: { ...state.collapsed, [action.panel]: !state.collapsed[action.panel] },
    };
  }
  if (state.restore) return { collapsed: { ...state.restore }, restore: null };
  if (MAP_PANEL_IDS.every((panel) => state.collapsed[panel])) {
    return { collapsed: { cases: false, data: false, search: false }, restore: null };
  }
  return {
    collapsed: { cases: true, data: true, search: true },
    restore: { ...state.collapsed },
  };
}
