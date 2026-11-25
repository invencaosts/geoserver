import {
  initialMapPanelsState,
  mapPanelsReducer,
} from "../../../web/src/components/map/map-panels-state";

describe("visibilidade dos painéis do mapa", () => {
  it("recolhe cada painel sem modificar o estado dos outros", () => {
    const result = mapPanelsReducer(initialMapPanelsState, { type: "toggle", panel: "search" });
    expect(result.collapsed).toEqual({ cases: false, data: false, search: true });
    expect(initialMapPanelsState.collapsed.search).toBe(false);
  });
  it("restaura exatamente os painéis abertos antes do recolhimento global", () => {
    const before = mapPanelsReducer(initialMapPanelsState, { type: "toggle", panel: "data" });
    const hidden = mapPanelsReducer(before, { type: "toggleAll" });
    expect(hidden.collapsed).toEqual({ cases: true, data: true, search: true });
    expect(mapPanelsReducer(hidden, { type: "toggleAll" })).toEqual(before);
  });
  it("preserva o snapshot global mesmo se um painel for reaberto individualmente", () => {
    const before = mapPanelsReducer(initialMapPanelsState, { type: "toggle", panel: "cases" });
    const hidden = mapPanelsReducer(before, { type: "toggleAll" });
    const opened = mapPanelsReducer(hidden, { type: "toggle", panel: "data" });
    expect(opened.collapsed).toEqual({ cases: true, data: false, search: true });
    expect(mapPanelsReducer(opened, { type: "toggleAll" })).toEqual(before);
  });
  it("inicia compacto no celular e permite expandir todos sem snapshot anterior", () => {
    const mobile = mapPanelsReducer(initialMapPanelsState, { type: "initialMobile" });
    expect(mobile.collapsed).toEqual({ cases: true, data: true, search: true });
    expect(mapPanelsReducer(mobile, { type: "toggleAll" })).toEqual(initialMapPanelsState);
  });
});
