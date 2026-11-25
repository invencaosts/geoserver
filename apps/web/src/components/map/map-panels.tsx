"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  ChevronUp,
  Layers3,
  MapPinned,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MAP_PANEL_IDS,
  initialMapPanelsState,
  mapPanelsReducer,
  type MapPanelId,
  type MapPanelsAction,
  type MapPanelsState,
} from "./map-panels-state";
import "./map-panels.css";

const MapPanelsContext = createContext<{
  state: MapPanelsState;
  dispatch: Dispatch<MapPanelsAction>;
} | null>(null);
const PANEL_TEXT = {
  cases: { title: "Camadas de casos de grilagem", short: "Casos de grilagem", Icon: MapPinned },
  data: { title: "Camadas de dados geográficos", short: "Dados geográficos", Icon: Layers3 },
  search: { title: "Busca no mapa", short: "Busca", Icon: Search },
} as const;

export function MapPanelsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(mapPanelsReducer, initialMapPanelsState);
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) dispatch({ type: "initialMobile" });
  }, []);
  useEffect(() => {
    const workspace = document.querySelector<HTMLElement>(".map-workspace");
    if (!workspace) return;
    let frame = 0;
    const observed = new WeakSet<Element>();
    const measure = () => {
      const bounds = workspace.getBoundingClientRect();
      const controls = workspace.querySelector<HTMLElement>(".maplibregl-ctrl-bottom-right");
      if (!controls) return;
      if (!observed.has(controls)) {
        observed.add(controls);
        resize.observe(controls);
      }
      const rect = controls.getBoundingClientRect();
      if (rect.height <= 0) return;
      const inset = `${Math.ceil(Math.max(0, bounds.bottom - rect.top) + 12)}px`;
      if (workspace.style.getPropertyValue("--map-controls-bottom") !== inset) {
        workspace.style.setProperty("--map-controls-bottom", inset);
        window.dispatchEvent(new CustomEvent("map-panels-change"));
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(workspace);
    const mutations = new MutationObserver(schedule);
    mutations.observe(workspace, { childList: true, subtree: true });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutations.disconnect();
    };
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      window.dispatchEvent(new CustomEvent("map-panels-change")),
    );
    return () => cancelAnimationFrame(frame);
  }, [state]);
  return (
    <MapPanelsContext.Provider value={{ state, dispatch }}>{children}</MapPanelsContext.Provider>
  );
}

function useMapPanels() {
  const context = useContext(MapPanelsContext);
  if (!context) throw new Error("MapPanel precisa de MapPanelsProvider");
  return context;
}

export function MapPanel({
  id,
  children,
  className,
}: {
  id: MapPanelId;
  children: ReactNode;
  className?: string;
}) {
  const { state, dispatch } = useMapPanels();
  const collapsed = state.collapsed[id];
  const contentId = useId();
  const headingId = useId();
  const { title, short, Icon } = PANEL_TEXT[id];
  return (
    <section
      data-map-obstruction
      data-map-panel={id}
      data-collapsed={collapsed}
      aria-labelledby={headingId}
      className={cn("map-panel glass-panel", `map-panel-${id}`, className)}
    >
      <h2 id={headingId} className="map-panel-heading" aria-label={title}>
        <button
          type="button"
          className="map-panel-toggle"
          aria-label={`${collapsed ? "Expandir" : "Recolher"} ${title}`}
          aria-expanded={!collapsed}
          aria-controls={contentId}
          title={`${collapsed ? "Expandir" : "Recolher"} ${title}`}
          onClick={() => dispatch({ type: "toggle", panel: id })}
        >
          <Icon aria-hidden className="map-panel-icon" />
          <span>{collapsed ? short : title}</span>
          {collapsed ? (
            <ChevronDown aria-hidden className="map-panel-chevron" />
          ) : (
            <ChevronUp aria-hidden className="map-panel-chevron" />
          )}
        </button>
      </h2>
      <div id={contentId} hidden={collapsed} className="map-panel-content">
        {children}
      </div>
    </section>
  );
}

export function MapPanelsToggle() {
  const { state, dispatch } = useMapPanels();
  const restoring =
    state.restore !== null || MAP_PANEL_IDS.every((panel) => state.collapsed[panel]);
  const title = restoring ? "Restaurar painéis" : "Recolher painéis";
  const Icon = restoring ? PanelLeftOpen : PanelLeftClose;
  return (
    <div data-map-obstruction className="map-panels-global">
      <button
        type="button"
        className="map-panels-global-button glass-panel"
        aria-label={title}
        title={title}
        onClick={() => dispatch({ type: "toggleAll" })}
      >
        <Icon aria-hidden />
        <span>{title}</span>
      </button>
    </div>
  );
}
