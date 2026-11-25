import { mapPopupObstructions, replaceMapPopup } from "../../../web/src/components/map/map-popup";

describe("ciclo de vida dos detalhes do mapa", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("considera painéis irmãos do canvas e controles nativos, sem confundir seus contêineres", () => {
    const cases = { id: "cases-panel" };
    const data = { id: "data-panel" };
    const tab = { id: "search-tab" };
    const navigation = { id: "navigation" };
    const workspace = { querySelectorAll: vi.fn(() => [cases, data, tab]) };
    const canvasContainer = {
      closest: vi.fn(() => workspace),
      querySelectorAll: vi.fn(() => [navigation]),
    };
    expect(mapPopupObstructions(canvasContainer as unknown as HTMLElement)).toEqual([
      cases,
      data,
      tab,
      navigation,
    ]);
    expect(canvasContainer.closest).toHaveBeenCalledWith(".map-workspace");
    expect(workspace.querySelectorAll).toHaveBeenCalledWith("[data-map-obstruction]");
    expect(canvasContainer.querySelectorAll).toHaveBeenCalledWith(".maplibregl-ctrl");
  });

  it("aguarda o DOM quando MapLibre abre sem conteúdo e cancela a observação ao fechar", () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      "MutationObserver",
      class {
        observe = observe;
        disconnect = disconnect;
      },
    );
    const container = {};
    const map = { getContainer: () => container };
    const listeners = new Map<string, (() => void)[]>();
    const popup = {
      isOpen: () => true,
      getElement: () => undefined,
      once: (event: string, listener: () => void) => {
        listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      },
      on: (event: string, listener: () => void) => {
        listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      },
    };
    replaceMapPopup(
      map as unknown as Parameters<typeof replaceMapPopup>[0],
      popup as unknown as Parameters<typeof replaceMapPopup>[1],
    );
    expect(() => listeners.get("open")?.forEach((listener) => listener())).not.toThrow();
    expect(observe).toHaveBeenCalledWith(container, { childList: true });
    listeners.get("close")?.forEach((listener) => listener());
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
