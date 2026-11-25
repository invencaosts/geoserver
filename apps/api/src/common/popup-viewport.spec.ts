import {
  popupFreeRect,
  popupPlacement,
  popupRectAt,
  type PopupRect,
} from "../../../web/src/components/map/popup-viewport";

function expectInside(rect: PopupRect, free: PopupRect) {
  expect(rect.left).toBeGreaterThanOrEqual(free.left - 0.001);
  expect(rect.right).toBeLessThanOrEqual(free.right + 0.001);
  expect(rect.top).toBeGreaterThanOrEqual(free.top - 0.001);
  expect(rect.bottom).toBeLessThanOrEqual(free.bottom + 0.001);
}

describe("área útil dos detalhes do mapa", () => {
  it("mantém detalhes nas quatro bordas com âncora e deslocamento mínimos", () => {
    const free = popupFreeRect(1000, 700, []);
    const size = { width: 340, height: 420 };
    for (const point of [
      { x: 2, y: 2 },
      { x: 998, y: 2 },
      { x: 2, y: 698 },
      { x: 998, y: 698 },
    ]) {
      const result = popupPlacement(point, size, free);
      const rect = popupRectAt(
        { x: point.x + result.shiftX, y: point.y + result.shiftY },
        size,
        result.anchor,
      );
      expectInside(rect, free);
    }
  });
  it("usa medidas de painéis abertos, abas e controles, não um offset fixo", () => {
    const panels = [
      { left: 10, top: 10, right: 330, bottom: 240 },
      { left: 10, top: 420, right: 300, bottom: 690 },
      { left: 700, top: 10, right: 990, bottom: 80 },
    ];
    const open = popupFreeRect(1000, 700, panels);
    expect(open.left).toBeGreaterThanOrEqual(336);
    const collapsed = popupFreeRect(1000, 700, [{ left: 10, top: 10, right: 54, bottom: 54 }]);
    expect((collapsed.right - collapsed.left) * (collapsed.bottom - collapsed.top)).toBeGreaterThan(
      (open.right - open.left) * (open.bottom - open.top),
    );
    expectInside(
      popupRectAt(
        { x: 500, y: 350 },
        { width: 340, height: 250 },
        popupPlacement({ x: 500, y: 350 }, { width: 340, height: 250 }, open).anchor,
      ),
      open,
    );
  });
  it("recalcula área no celular e após redimensionar a janela", () => {
    const narrow = popupFreeRect(322, 580, [
      { left: 8, top: 8, right: 190, bottom: 64 },
      { left: 8, top: 400, right: 190, bottom: 570 },
    ]);
    expect(narrow.left).toBeGreaterThanOrEqual(0);
    expect(narrow.right).toBeLessThanOrEqual(322);
    expect(narrow.bottom - narrow.top).toBeGreaterThanOrEqual(100);
    const landscape = popupFreeRect(740, 300, [{ left: 8, top: 8, right: 200, bottom: 80 }]);
    expect(landscape.right - landscape.left).toBeGreaterThan(narrow.right - narrow.left);
  });
  it("não desloca a câmera quando a âncora alternativa já cabe", () => {
    const result = popupPlacement(
      { x: 500, y: 80 },
      { width: 300, height: 260 },
      { left: 10, top: 10, right: 990, bottom: 690 },
    );
    expect(result.anchor).toBe("top");
    expect(result.shiftX).toBe(0);
    expect(result.shiftY).toBe(0);
  });
});
