import { applyToMapStyle } from "../../../web/src/components/map/map-style-ready";

describe("camadas no estilo já inicializado", () => {
  it("adiciona casos mesmo quando as fontes de datasets ainda estão carregando", () => {
    const added: string[] = [];
    const map = {
      getStyle: vi.fn(() => ({ version: 8, sources: {}, layers: [] })),
      isStyleLoaded: vi.fn(() => false),
      once: vi.fn(),
      off: vi.fn(),
    };
    const ready = map as unknown as Parameters<typeof applyToMapStyle>[0];
    applyToMapStyle(ready, () => added.push("dataset-fill"));
    applyToMapStyle(ready, () => added.push("cases-circle"));
    expect(added).toEqual(["dataset-fill", "cases-circle"]);
    expect(map.once).not.toHaveBeenCalled();
    expect(map.isStyleLoaded).not.toHaveBeenCalled();
  });

  it("espera style.load apenas se o estilo não existir, e cancela uma atualização descartada", () => {
    let listener: (() => void) | undefined;
    const map = {
      getStyle: vi.fn(() => undefined),
      once: vi.fn((_event: string, handler: () => void) => {
        listener = handler;
      }),
      off: vi.fn(),
    };
    const apply = vi.fn();
    const cancel = applyToMapStyle(map as unknown as Parameters<typeof applyToMapStyle>[0], apply);
    expect(map.once).toHaveBeenCalledWith("style.load", expect.any(Function));
    expect(apply).not.toHaveBeenCalled();
    cancel();
    listener?.();
    expect(apply).not.toHaveBeenCalled();
    expect(map.off).toHaveBeenCalledWith("style.load", expect.any(Function));
  });
});
