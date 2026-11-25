"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { Search } from "lucide-react";
import { CASE_TIPO_LABEL as TIPO_LABEL, type CaseTipo } from "@geo/shared";
import { Input } from "@/components/ui/input";
import { MapView } from "@/components/map/map-view";
import { LayersPanel } from "@/components/map/layers-panel";
import { DatasetMapLayers } from "@/components/map/dataset-map-layers";
import { replaceMapPopup } from "@/components/map/map-popup";
import { applyToMapStyle } from "@/components/map/map-style-ready";
import { useAuthStore } from "@/lib/auth-store";
import { useCaseMapPoints } from "@/lib/queries/cases";

const PRIORIDADE_COLOR: Record<string, string> = {
  critica: "#ef4444",
  alta: "#f97316",
  media: "#eab308",
  baixa: "#22c55e",
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_verificacao: "Em verificação",
  validado: "Validado",
  rejeitado: "Rejeitado",
};

export default function MapaPage() {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const boundsFitRef = useRef(false);
  const casePopupRef = useRef<maplibregl.Popup | null>(null);
  const token = useAuthStore((state) => state.token);
  const [search, setSearch] = useState("");
  const { data: cases } = useCaseMapPoints();

  const onMapReady = useCallback((map: maplibregl.Map) => {
    setMap(map);
  }, []);

  useEffect(() => {
    casePopupRef.current?.remove();
    return () => {
      casePopupRef.current?.remove();
    };
  }, [map, token]);

  // plota casos de grilagem como pontos coloridos por prioridade
  useEffect(() => {
    if (!map || !cases) return;

    const geojson = {
      type: "FeatureCollection" as const,
      features: cases
        .filter((c): c is typeof c & { lat: number; lng: number } => c.lat != null && c.lng != null)
        .map((c) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
          properties: { nome: c.nome, tipo: c.tipo, prioridade: c.prioridade, status: c.status },
        })),
    };

    const apply = () => {
      const source = map.getSource("cases") as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(geojson);
      } else {
        map.addSource("cases", { type: "geojson", data: geojson });
        map.addLayer({
          id: "cases-circle",
          type: "circle",
          source: "cases",
          paint: {
            "circle-radius": 7,
            "circle-color": [
              "match",
              ["get", "prioridade"],
              "critica",
              PRIORIDADE_COLOR.critica,
              "alta",
              PRIORIDADE_COLOR.alta,
              "media",
              PRIORIDADE_COLOR.media,
              "baixa",
              PRIORIDADE_COLOR.baixa,
              "#94a3b8",
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        map.on("mouseenter", "cases-circle", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "cases-circle", () => {
          map.getCanvas().style.cursor = "";
        });
        map.on("click", "cases-circle", (e) => {
          const feature = e.features?.[0];
          if (!feature || feature.geometry.type !== "Point") return;
          const { nome, tipo, prioridade, status } = feature.properties as Record<string, string>;
          const content = document.createElement("div");
          content.style.fontSize = "12.5px";
          content.style.lineHeight = "1.5";
          const title = document.createElement("strong");
          title.textContent = nome;
          const typeLine = document.createElement("div");
          typeLine.textContent = TIPO_LABEL[tipo as CaseTipo] ?? tipo;
          const statusLine = document.createElement("div");
          statusLine.textContent = `Prioridade: ${prioridade} · ${STATUS_LABEL[status] ?? status}`;
          content.append(title, typeLine, statusLine);
          casePopupRef.current?.remove();
          casePopupRef.current = replaceMapPopup(
            map,
            new maplibregl.Popup({ closeButton: true, offset: 10 }),
          )
            .setLngLat(feature.geometry.coordinates as [number, number])
            .setDOMContent(content)
            .addTo(map);
        });
      }

      // na primeira carga, enquadra a câmera nos casos ao invés de ficar preso no centro padrão
      if (!boundsFitRef.current && geojson.features.length > 0) {
        boundsFitRef.current = true;
        if (geojson.features.length === 1) {
          map.flyTo({
            center: geojson.features[0].geometry.coordinates as [number, number],
            zoom: 10,
            padding: { top: 100, right: 100, bottom: 100, left: 620 },
          });
        } else {
          const bounds = geojson.features.reduce(
            (b, f) => b.extend(f.geometry.coordinates as [number, number]),
            new maplibregl.LngLatBounds(
              geojson.features[0].geometry.coordinates as [number, number],
              geojson.features[0].geometry.coordinates as [number, number],
            ),
          );
          map.fitBounds(bounds, {
            padding: { top: 100, right: 100, bottom: 100, left: 620 },
            maxZoom: 12,
          });
        }
      }
    };

    return applyToMapStyle(map, apply);
  }, [map, cases]);

  return (
    <div className="relative h-full w-full">
      <MapView onMapReady={onMapReady} />
      <DatasetMapLayers map={map} />

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
