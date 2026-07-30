"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type maplibregl from "maplibre-gl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MapView } from "@/components/map/map-view";
import { LayersPanel } from "@/components/map/layers-panel";
import { useCases } from "@/lib/queries/cases";
import { useDatasets } from "@/lib/queries/datasets";
import { apiFetch } from "@/lib/api";

const PRIORIDADE_COLOR: Record<string, string> = {
  critica: "#ef4444",
  alta: "#f97316",
  media: "#eab308",
  baixa: "#22c55e",
};

export default function MapaPage() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [search, setSearch] = useState("");
  const { data: cases } = useCases();
  const { data: datasets } = useDatasets();

  const onMapReady = useCallback((map: maplibregl.Map) => {
    mapRef.current = map;
  }, []);

  // plota casos de grilagem como pontos coloridos por prioridade
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cases) return;

    const geojson = {
      type: "FeatureCollection" as const,
      features: cases
        .filter((c) => c.lat != null && c.lng != null)
        .map((c) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
          properties: { nome: c.nome, prioridade: c.prioridade, status: c.status },
        })),
    };

    const apply = () => {
      const source = map.getSource("cases") as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(geojson as any);
        return;
      }
      map.addSource("cases", { type: "geojson", data: geojson as any });
      map.addLayer({
        id: "cases-circle",
        type: "circle",
        source: "cases",
        paint: {
          "circle-radius": 7,
          "circle-color": [
            "match",
            ["get", "prioridade"],
            "critica", PRIORIDADE_COLOR.critica,
            "alta", PRIORIDADE_COLOR.alta,
            "media", PRIORIDADE_COLOR.media,
            "baixa", PRIORIDADE_COLOR.baixa,
            "#94a3b8",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [cases]);

  // plota features dos datasets ativos
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !datasets) return;

    const active = datasets.filter((d) => d.status === "active");

    active.forEach(async (dataset) => {
      const sourceId = `dataset-${dataset.id}`;
      if (map.getSource(sourceId)) return;
      const geojson = await apiFetch(`/datasets/${dataset.id}/export`);

      const addLayer = () => {
        if (map.getSource(sourceId)) return;
        map.addSource(sourceId, { type: "geojson", data: geojson as any });
        map.addLayer({
          id: `${sourceId}-layer`,
          type: dataset.tipoGeometria === "Polygon" ? "fill" : dataset.tipoGeometria === "Line" ? "line" : "circle",
          source: sourceId,
          paint:
            dataset.tipoGeometria === "Polygon"
              ? { "fill-color": "#22c55e", "fill-opacity": 0.35, "fill-outline-color": "#16a34a" }
              : dataset.tipoGeometria === "Line"
                ? { "line-color": "#3b82f6", "line-width": 2 }
                : { "circle-radius": 5, "circle-color": "#3b82f6", "circle-stroke-width": 1, "circle-stroke-color": "#fff" },
        } as maplibregl.LayerSpecification);
      };

      if (map.isStyleLoaded()) addLayer();
      else map.once("load", addLayer);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasets]);

  return (
    <div className="relative h-full w-full">
      <MapView onMapReady={onMapReady} />

      <div className="absolute left-4 top-4 z-10">
        <LayersPanel />
      </div>

      <div className="absolute right-4 top-4 z-10 w-72">
        <div className="glass-panel flex items-center gap-2 rounded-lg px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar casos, coordenadas ou municípios..."
            className="h-7 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
        </div>
      </div>
    </div>
  );
}
