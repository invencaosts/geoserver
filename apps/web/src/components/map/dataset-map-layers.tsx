"use client";

import { useEffect, useRef, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import * as maplibregl from "maplibre-gl";
import type { DatasetMapMetadata } from "@geo/shared";
import { LocateFixed, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDatasets } from "@/lib/queries/datasets";
import { API_URL, apiFetch } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { datasetColor } from "@/lib/dataset-map-presentation";
import { createDatasetPopupController } from "./dataset-popup";
import { replaceMapPopup } from "./map-popup";
import { applyToMapStyle } from "./map-style-ready";
import { DatasetMapConfigSheet } from "./dataset-map-config";
import { MapPanel } from "./map-panels";

const SUFFIXES = ["fill", "line", "points", "clusters"];

function sourceId(datasetId: string) {
  return `dataset-${datasetId}`;
}

function removeDatasetSources(map: maplibregl.Map) {
  for (const layer of [...(map.getStyle()?.layers ?? [])].reverse()) {
    if (layer.id.startsWith("dataset-")) map.removeLayer(layer.id);
  }
  for (const id of Object.keys(map.getStyle()?.sources ?? {})) {
    if (id.startsWith("dataset-")) map.removeSource(id);
  }
}

export function DatasetMapLayers({ map }: { map: maplibregl.Map | null }) {
  const { data: datasets, isError: datasetError } = useDatasets();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const sessionKey = `${user?.id ?? "anonymous"}:${user?.role ?? ""}`;
  const queryClient = useQueryClient();
  const active = datasetError
    ? []
    : (datasets ?? []).filter((dataset) => dataset.status === "active");
  const metadataQueries = useQueries({
    queries: active.map((dataset) => ({
      queryKey: ["dataset-map-metadata", sessionKey, dataset.id],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiFetch<DatasetMapMetadata>(`/datasets/${encodeURIComponent(dataset.id)}/map-metadata`, {
          signal,
        }),
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  });
  const metadata = metadataQueries.flatMap((query) =>
    query.data && !query.isError ? [query.data] : [],
  );
  const metadataSignature = JSON.stringify(metadata);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const hiddenRef = useRef(hidden);
  useEffect(() => {
    hiddenRef.current = hidden;
  }, [hidden]);
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [tileError, setTileError] = useState<string | null>(null);

  useEffect(() => {
    if (!map) return;
    let disposed = false;
    const layers = JSON.parse(metadataSignature) as DatasetMapMetadata[];
    popupRef.current?.remove();
    removeDatasetSources(map);

    const apply = () => {
      if (disposed) return;
      for (const dataset of layers) {
        const source = sourceId(dataset.datasetId);
        const color = dataset.config.color ?? datasetColor(dataset.datasetId);
        const before = map.getLayer("cases-circle") ? "cases-circle" : undefined;
        const visibility = hiddenRef.current.has(dataset.datasetId) ? "none" : "visible";
        const tileUrl = new URL(
          `${API_URL.replace(/\/$/, "")}/datasets/${encodeURIComponent(dataset.datasetId)}/tiles/{z}/{x}/{y}.mvt`,
          window.location.href,
        ).href;
        map.addSource(source, {
          type: "vector",
          tiles: [tileUrl.replace(/%7B/g, "{").replace(/%7D/g, "}")],
          minzoom: 0,
          maxzoom: 22,
          promoteId: "featureId",
        });
        const common = { source, "source-layer": "features", layout: { visibility } } as const;
        map.addLayer(
          {
            ...common,
            id: `${source}-fill`,
            type: "fill",
            filter: ["==", ["geometry-type"], "Polygon"],
            paint: { "fill-color": color, "fill-opacity": 0.3 },
          },
          before,
        );
        map.addLayer(
          {
            ...common,
            id: `${source}-line`,
            type: "line",
            filter: ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]],
            paint: { "line-color": color, "line-width": 2 },
          },
          before,
        );
        map.addLayer(
          {
            ...common,
            id: `${source}-points`,
            type: "circle",
            filter: ["all", ["==", ["geometry-type"], "Point"], ["!=", ["get", "cluster"], true]],
            paint: {
              "circle-color": color,
              "circle-radius": 5,
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1.2,
            },
          },
          before,
        );
        map.addLayer(
          {
            ...common,
            id: `${source}-clusters`,
            type: "circle",
            filter: ["==", ["get", "cluster"], true],
            paint: {
              "circle-color": color,
              "circle-radius": ["step", ["get", "point_count"], 15, 100, 20, 1000, 25],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            },
          },
          before,
        );
      }
      if (map.getLayer("cases-circle")) map.moveLayer("cases-circle");
    };

    const datasetFeatures = (point: maplibregl.Point) => {
      const ids = layers
        .flatMap((dataset) => SUFFIXES.map((suffix) => `${sourceId(dataset.datasetId)}-${suffix}`))
        .filter((id) => !!map.getLayer(id));
      return ids.length ? map.queryRenderedFeatures(point, { layers: ids }) : [];
    };
    const click = (event: maplibregl.MapMouseEvent) => {
      if (
        map.getLayer("cases-circle") &&
        map.queryRenderedFeatures(event.point, { layers: ["cases-circle"] }).length
      ) {
        popupRef.current?.remove();
        return;
      }
      const features = datasetFeatures(event.point);
      const unique = new Map(
        features.map((feature) => {
          const properties = feature.properties;
          return [
            `${properties.datasetId}:${properties.featureId ?? `${properties.z}:${properties.clusterCellX}:${properties.clusterCellY}`}`,
            feature,
          ];
        }),
      );
      const feature = unique.values().next().value;
      if (!feature) return;
      const properties = feature.properties;
      const dataset = layers.find((item) => item.datasetId === properties.datasetId);
      if (!dataset) return;
      popupRef.current?.remove();
      // Um clique em camada importada fecha também um popup anterior de caso.
      const popup = replaceMapPopup(
        map,
        new maplibregl.Popup({ closeButton: true, maxWidth: "360px", offset: 10 }),
      ).setLngLat(event.lngLat);
      // MapLibre só cria o elemento do popup quando já existe conteúdo.
      const controller = createDatasetPopupController(popup, dataset.name);
      popup.addTo(map);
      popupRef.current = popup;
      if (properties.cluster === true) {
        controller.showCluster(
          dataset.datasetId,
          Number(properties.z),
          Number(properties.clusterCellX),
          Number(properties.clusterCellY),
          Number(properties.point_count),
        );
      } else if (typeof properties.featureId === "string") {
        void controller.showFeature(dataset.datasetId, properties.featureId);
      }
    };
    const move = (event: maplibregl.MapMouseEvent) => {
      if (datasetFeatures(event.point).length) map.getCanvas().style.cursor = "pointer";
      else if (
        !map.getLayer("cases-circle") ||
        !map.queryRenderedFeatures(event.point, { layers: ["cases-circle"] }).length
      )
        map.getCanvas().style.cursor = "";
    };
    const failed = (event: maplibregl.ErrorEvent) => {
      const source = "sourceId" in event ? event.sourceId : undefined;
      if (typeof source !== "string" || !source.startsWith("dataset-")) return;
      setTileError(
        "Não foi possível carregar parte das camadas. Tente novamente ou confira seu acesso.",
      );
      const status = "status" in event.error ? event.error.status : undefined;
      if (status === 401) useAuthStore.getState().clear();
      if (status === 401 || status === 403 || status === 404) {
        popupRef.current?.remove();
        for (const suffix of [...SUFFIXES].reverse())
          if (map.getLayer(`${source}-${suffix}`)) map.removeLayer(`${source}-${suffix}`);
        if (map.getSource(source)) map.removeSource(source);
        void queryClient.invalidateQueries({ queryKey: ["datasets"] });
        void queryClient.invalidateQueries({ queryKey: ["dataset-map-metadata"] });
      }
    };

    const cancelStyleApply = applyToMapStyle(map, apply);
    map.on("click", click);
    map.on("mousemove", move);
    map.on("error", failed);
    return () => {
      disposed = true;
      cancelStyleApply();
      map.off("click", click);
      map.off("mousemove", move);
      map.off("error", failed);
      popupRef.current?.remove();
      removeDatasetSources(map);
    };
  }, [map, metadataSignature, sessionKey, token, queryClient, reloadNonce]);

  useEffect(() => {
    if (!map) return;
    for (const dataset of metadata) {
      for (const suffix of SUFFIXES) {
        const id = `${sourceId(dataset.datasetId)}-${suffix}`;
        if (map.getLayer(id))
          map.setLayoutProperty(
            id,
            "visibility",
            hidden.has(dataset.datasetId) ? "none" : "visible",
          );
      }
    }
    popupRef.current?.remove();
    // metadataSignature representa os dados, sem recriar o efeito a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, hidden, metadataSignature]);

  const config = metadata.find((dataset) => dataset.datasetId === selectedConfig);
  return (
    <>
      <MapPanel id="data">
        <div className="p-3 text-xs">
          {!active.length && (
            <p className="text-muted-foreground">
              Nenhuma camada de dados geográficos disponível neste acesso.
            </p>
          )}
          {active.map((dataset, index) => {
            const query = metadataQueries[index];
            const details = query?.data;
            return (
              <div
                key={dataset.id}
                className="mb-2 border-b border-border pb-2 last:mb-0 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Exibir ${dataset.nome}`}
                    checked={!hidden.has(dataset.id)}
                    disabled={!details || query.isError}
                    onChange={(event) =>
                      setHidden((previous) => {
                        const next = new Set(previous);
                        if (event.target.checked) next.delete(dataset.id);
                        else next.add(dataset.id);
                        return next;
                      })
                    }
                  />
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: details?.config.color ?? datasetColor(dataset.id) }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 break-words">{dataset.nome}</span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    title={`Enquadrar ${dataset.nome}`}
                    disabled={!details?.bounds || query.isError}
                    onClick={() => {
                      if (details?.bounds)
                        map?.fitBounds(
                          [
                            [details.bounds[0], details.bounds[1]],
                            [details.bounds[2], details.bounds[3]],
                          ],
                          { padding: 80, maxZoom: 15 },
                        );
                    }}
                  >
                    <LocateFixed className="h-3.5 w-3.5" />
                  </Button>
                  {details?.canConfigure && !query.isError && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title={`Configurar ${dataset.nome}`}
                      onClick={() => setSelectedConfig(dataset.id)}
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {dataset.registros.toLocaleString("pt-BR")} feições · {dataset.tipoGeometria} ·{" "}
                  {dataset.visibility === "restrito" ? "Restrito" : "Público"}
                </p>
                {query?.isPending && <p role="status">Carregando camada…</p>}
                {query?.isError && (
                  <button
                    type="button"
                    className="text-destructive underline"
                    onClick={() => void query.refetch()}
                  >
                    Falha ao carregar. Tentar novamente.
                  </button>
                )}
              </div>
            );
          })}
          {active.some((dataset) => dataset.tipoGeometria === "Point") && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Pontos próximos são agrupados; clique no agrupamento para listar e abrir cada feição.
            </p>
          )}
          {tileError && (
            <p role="alert" className="mt-2 text-destructive">
              {tileError}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setTileError(null);
                  setReloadNonce((value) => value + 1);
                  void queryClient.invalidateQueries({ queryKey: ["dataset-map-metadata"] });
                }}
              >
                Tentar novamente
              </button>
            </p>
          )}
        </div>
      </MapPanel>
      {config?.canConfigure && (
        <DatasetMapConfigSheet
          key={`${sessionKey}:${config.datasetId}`}
          metadata={config}
          onClose={() => setSelectedConfig(null)}
        />
      )}
    </>
  );
}
