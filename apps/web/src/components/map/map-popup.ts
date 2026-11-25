import type { Map, Popup } from "maplibre-gl";
import { popupFreeRect, popupPlacement, type PopupRect } from "./popup-viewport";
import "./map-popup.css";

const popups = new WeakMap<Map, Popup>();

/** React panels are siblings of MapLibre's canvas, inside the same workspace. */
export function mapPopupObstructions(container: HTMLElement): HTMLElement[] {
  const workspace = container.closest(".map-workspace") ?? container.parentElement ?? container;
  return [
    ...new Set([
      ...workspace.querySelectorAll<HTMLElement>("[data-map-obstruction]"),
      ...container.querySelectorAll<HTMLElement>(".maplibregl-ctrl"),
    ]),
  ];
}

function structureContent(element: HTMLElement) {
  const content = element.querySelector<HTMLElement>(".maplibregl-popup-content");
  const root =
    content &&
    [...content.children].find(
      (child) => !child.classList.contains("maplibregl-popup-close-button"),
    );
  if (!(root instanceof HTMLElement)) return;
  root.classList.add("map-popup-root");
  if (root.querySelector(":scope > .map-popup-header")) return;
  const header = document.createElement("div");
  header.className = "map-popup-header";
  const body = document.createElement("div");
  body.className = "map-popup-body";
  body.tabIndex = 0;
  body.setAttribute("role", "region");
  body.setAttribute("aria-label", "Conteúdo dos detalhes");
  const title = root.querySelector("strong, h3");
  if (title) header.append(title);
  else {
    const fallback = document.createElement("h3");
    fallback.textContent = "Detalhes no mapa";
    header.append(fallback);
  }
  body.append(...root.childNodes);
  root.replaceChildren(header, body);
}

function managePopupViewport(map: Map, popup: Popup) {
  const container = map.getContainer();
  const element = popup.getElement();
  // MapLibre permite addTo antes de setDOMContent. Nesse caso o evento open
  // precede o elemento; aguarde sua inclusão sem consultar campos privados.
  if (!element) {
    const observer = new MutationObserver(() => {
      if (!popup.isOpen()) {
        observer.disconnect();
        return;
      }
      if (popup.getElement()) {
        observer.disconnect();
        managePopupViewport(map, popup);
      }
    });
    observer.observe(container, { childList: true });
    popup.once("close", () => observer.disconnect());
    return;
  }
  popup.addClassName("map-detail-popup");
  let frame = 0;
  let disposed = false;
  let layingOut = false;
  const focusedBefore = document.activeElement;
  const originalOffset = popup.options.offset;
  const observed = new Set<Element>();
  let previousWidth = container.clientWidth;
  let previousHeight = container.clientHeight;

  const schedule = () => {
    if (disposed || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      fit();
    });
  };
  const resize = new ResizeObserver(() => {
    if (container.clientWidth !== previousWidth || container.clientHeight !== previousHeight) {
      previousWidth = container.clientWidth;
      previousHeight = container.clientHeight;
      map.resize();
    }
    schedule();
  });
  resize.observe(container);
  resize.observe(element);
  const mutation = new MutationObserver(schedule);
  mutation.observe(element, { childList: true, subtree: true, characterData: true });

  function obstructionRects(mapRect: DOMRect) {
    const rects: PopupRect[] = [];
    const obstructions = mapPopupObstructions(container);
    for (const node of obstructions) {
      if (!observed.has(node)) {
        observed.add(node);
        resize.observe(node);
      }
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || getComputedStyle(node).visibility === "hidden")
        continue;
      rects.push({
        left: rect.left - mapRect.left,
        top: rect.top - mapRect.top,
        right: rect.right - mapRect.left,
        bottom: rect.bottom - mapRect.top,
      });
    }
    // Account for a keyboard or a map partially outside the visual viewport.
    const viewport = window.visualViewport;
    const viewLeft = viewport?.offsetLeft ?? 0,
      viewTop = viewport?.offsetTop ?? 0;
    const viewRight = viewLeft + (viewport?.width ?? window.innerWidth),
      viewBottom = viewTop + (viewport?.height ?? window.innerHeight);
    if (mapRect.left < viewLeft)
      rects.push({ left: 0, top: 0, right: viewLeft - mapRect.left, bottom: mapRect.height });
    if (mapRect.top < viewTop)
      rects.push({ left: 0, top: 0, right: mapRect.width, bottom: viewTop - mapRect.top });
    if (mapRect.right > viewRight)
      rects.push({
        left: viewRight - mapRect.left,
        top: 0,
        right: mapRect.width,
        bottom: mapRect.height,
      });
    if (mapRect.bottom > viewBottom)
      rects.push({
        left: 0,
        top: viewBottom - mapRect.top,
        right: mapRect.width,
        bottom: mapRect.height,
      });
    return rects;
  }

  function fit() {
    if (disposed || layingOut || !popup.isOpen()) return;
    layingOut = true;
    try {
      structureContent(element);
      const close = element.querySelector<HTMLButtonElement>(".maplibregl-popup-close-button");
      if (close) {
        close.setAttribute("aria-label", "Fechar detalhes");
        close.title = "Fechar detalhes (Escape)";
      }
      const mapRect = container.getBoundingClientRect();
      if (!mapRect.width || !mapRect.height) return;
      const free = popupFreeRect(mapRect.width, mapRect.height, obstructionRects(mapRect));
      const freeWidth = Math.max(1, free.right - free.left),
        freeHeight = Math.max(1, free.bottom - free.top);
      const sheet = mapRect.width <= 640 || freeWidth < 240 || freeHeight < 180;
      const width = Math.floor(Math.min(sheet ? 400 : 360, freeWidth));
      const maxHeight = Math.floor(Math.min(freeHeight, mapRect.height * (sheet ? 0.64 : 0.8)));
      element.style.setProperty("--map-popup-width", `${width}px`);
      element.style.setProperty(
        "--map-popup-height",
        `${Math.max(1, maxHeight - (sheet ? 2 : 12))}px`,
      );
      element.style.width = `${width}px`;
      element.classList.toggle("is-map-sheet", sheet);
      popup.setMaxWidth(`${width}px`);
      const header = element.querySelector<HTMLElement>(".map-popup-header");
      if (header) header.tabIndex = header.scrollHeight > header.clientHeight ? 0 : -1;
      const height = element.offsetHeight;
      if (sheet) {
        element.style.setProperty("--map-sheet-left", `${free.left + (freeWidth - width) / 2}px`);
        element.style.setProperty(
          "--map-sheet-top",
          `${Math.max(free.top, free.bottom - height)}px`,
        );
        return;
      }
      const point = map.project(popup.getLngLat());
      const placement = popupPlacement(point, { width, height }, free);
      // `options` is the public PopupOptions object. setOffset refreshes layout
      // through the public API, without calling MapLibre's private _update.
      popup.options.anchor = placement.anchor;
      popup.setOffset(10);
      if (!map.isMoving() && (Math.abs(placement.shiftX) > 2 || Math.abs(placement.shiftY) > 2)) {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        map.panBy([-placement.shiftX, -placement.shiftY], {
          duration: reduced ? 0 : 150,
          essential: false,
        });
      }
    } finally {
      layingOut = false;
    }
  }
  const escape = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented || popups.get(map) !== popup) return;
    event.preventDefault();
    popup.remove();
  };
  const cleanup = () => {
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    resize.disconnect();
    mutation.disconnect();
    window.removeEventListener("resize", schedule);
    window.removeEventListener("map-panels-change", schedule);
    window.visualViewport?.removeEventListener("resize", schedule);
    document.removeEventListener("keydown", escape);
    map.off("resize", schedule);
    map.off("moveend", schedule);
    popup.options.offset = originalOffset;
    if (element.contains(document.activeElement) || document.activeElement === document.body) {
      if (focusedBefore instanceof HTMLElement && focusedBefore.isConnected)
        focusedBefore.focus({ preventScroll: true });
      else map.getCanvas().focus({ preventScroll: true });
    }
  };
  window.addEventListener("resize", schedule);
  window.addEventListener("map-panels-change", schedule);
  window.visualViewport?.addEventListener("resize", schedule);
  document.addEventListener("keydown", escape);
  map.on("resize", schedule);
  map.on("moveend", schedule);
  popup.once("close", cleanup);
  fit();
  schedule();
}

/** Casos, feições e agrupamentos compartilham detalhes e o mesmo cálculo de área útil. */
export function replaceMapPopup(map: Map, popup: Popup): Popup {
  popups.get(map)?.remove();
  popups.set(map, popup);
  popup.once("open", () => managePopupViewport(map, popup));
  popup.on("close", () => {
    if (popups.get(map) === popup) popups.delete(map);
  });
  return popup;
}
