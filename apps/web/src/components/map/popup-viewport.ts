/** Geometry is expressed in CSS pixels relative to the actual map container. */
export interface PopupRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export type PopupAnchor =
  "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
export interface PopupPoint {
  x: number;
  y: number;
}
export interface PopupSize {
  width: number;
  height: number;
}

function intersects(a: PopupRect, b: PopupRect) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(value, Math.max(low, high)));

/** Find the largest visible rectangle that does not cover a panel, tab or control. */
export function popupFreeRect(
  width: number,
  height: number,
  obstructions: PopupRect[],
  margin = 10,
): PopupRect {
  const edge = Math.min(margin, Math.max(0, Math.min(width, height) / 8));
  const area = {
    left: edge,
    top: edge,
    right: Math.max(edge, width - edge),
    bottom: Math.max(edge, height - edge),
  };
  const obstacles = obstructions
    .filter((rect) => intersects(rect, area))
    .map((rect) => ({
      left: clamp(rect.left - 6, area.left, area.right),
      right: clamp(rect.right + 6, area.left, area.right),
      top: clamp(rect.top - 6, area.top, area.bottom),
      bottom: clamp(rect.bottom + 6, area.top, area.bottom),
    }));
  const xs = [
    ...new Set([area.left, area.right, ...obstacles.flatMap((r) => [r.left, r.right])]),
  ].sort((a, b) => a - b);
  const ys = [
    ...new Set([area.top, area.bottom, ...obstacles.flatMap((r) => [r.top, r.bottom])]),
  ].sort((a, b) => a - b);
  let best: PopupRect | undefined;
  let score = -1;
  for (let l = 0; l < xs.length - 1; l++)
    for (let r = l + 1; r < xs.length; r++) {
      for (let t = 0; t < ys.length - 1; t++)
        for (let b = t + 1; b < ys.length; b++) {
          const rect = { left: xs[l], right: xs[r], top: ys[t], bottom: ys[b] };
          if (obstacles.some((obstacle) => intersects(rect, obstacle))) continue;
          const w = rect.right - rect.left,
            h = rect.bottom - rect.top;
          // Prefer a region wide enough for readable text, then maximise its area.
          const readable =
            w >= Math.min(240, area.right - area.left) &&
            h >= Math.min(100, area.bottom - area.top);
          const candidate = w * h + (readable ? width * height : 0);
          if (candidate > score) {
            best = rect;
            score = candidate;
          }
        }
    }
  return best ?? area;
}

export function popupRectAt(
  point: PopupPoint,
  size: PopupSize,
  anchor: PopupAnchor,
  gap = 10,
): PopupRect {
  let left = point.x - size.width / 2,
    top = point.y - size.height / 2;
  if (anchor.includes("top")) top = point.y + gap;
  if (anchor.includes("bottom")) top = point.y - size.height - gap;
  if (anchor.includes("left")) left = point.x + gap;
  if (anchor.includes("right")) left = point.x - size.width - gap;
  return { left, top, right: left + size.width, bottom: top + size.height };
}

/** Choose the anchor requiring the least camera displacement, then pan only if necessary. */
export function popupPlacement(point: PopupPoint, size: PopupSize, free: PopupRect) {
  const anchors: PopupAnchor[] = [
    "bottom",
    "top",
    "left",
    "right",
    "bottom-left",
    "bottom-right",
    "top-left",
    "top-right",
  ];
  let best: { anchor: PopupAnchor; shiftX: number; shiftY: number; rect: PopupRect } | undefined;
  let cost = Infinity;
  for (const anchor of anchors) {
    const rect = popupRectAt(point, size, anchor);
    const shiftX = clamp(rect.left, free.left, free.right - size.width) - rect.left;
    const shiftY = clamp(rect.top, free.top, free.bottom - size.height) - rect.top;
    const nextCost = shiftX * shiftX + shiftY * shiftY;
    if (nextCost < cost) {
      best = { anchor, shiftX, shiftY, rect };
      cost = nextCost;
    }
  }
  return best!;
}
