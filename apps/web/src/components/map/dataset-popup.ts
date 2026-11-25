import type { DatasetMapClusterMembers, DatasetMapFeatureDetail } from "@geo/shared";
import type { Popup } from "maplibre-gl";
import { apiFetch } from "@/lib/api";
import {
  datasetFieldLabel,
  formatDatasetValue,
  isEmptyDatasetValue,
} from "@/lib/dataset-map-presentation";

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string, action: () => void) {
  const node = element("button", text);
  node.type = "button";
  node.className = "dataset-popup-button";
  node.addEventListener("click", action);
  return node;
}

export function createDatasetPopupController(popup: Popup, layerName: string) {
  const root = element("div");
  root.className = "dataset-popup";
  root.setAttribute("aria-live", "polite");
  popup.setDOMContent(root);
  let request: AbortController | undefined;
  let disposed = false;
  let revision = 0;

  popup.on("close", () => {
    disposed = true;
    request?.abort();
    revision += 1;
  });

  function start(title: string) {
    request?.abort();
    request = new AbortController();
    const current = ++revision;
    const layer = element("p", layerName);
    layer.className = "dataset-popup-layer";
    root.replaceChildren(layer, element("h3", title), element("p", "Carregando atributos…"));
    return { signal: request.signal, current };
  }

  function error(current: number, retry: () => void) {
    if (disposed || current !== revision) return;
    root.replaceChildren(
      element("p", layerName),
      element(
        "p",
        "Não foi possível carregar os detalhes. Verifique sua conexão e permissão de acesso.",
      ),
      button("Tentar novamente", retry),
    );
  }

  async function showFeature(datasetId: string, featureId: string, back?: () => void) {
    const { signal, current } = start("Detalhes da feição");
    try {
      const detail = await apiFetch<DatasetMapFeatureDetail>(
        `/datasets/${encodeURIComponent(datasetId)}/map-features/${encodeURIComponent(featureId)}`,
        { signal },
      );
      if (disposed || current !== revision) return;
      const layer = element("p", detail.layerName);
      layer.className = "dataset-popup-layer";
      const title = element("h3", detail.title);
      const fields = element("dl");
      for (const [key, value] of Object.entries(detail.properties)) {
        if (isEmptyDatasetValue(value)) continue;
        fields.append(
          element("dt", detail.labels[key] ?? datasetFieldLabel(key)),
          element("dd", formatDatasetValue(value)),
        );
      }
      const identity = element("p", `Feição: ${detail.id}`);
      identity.className = "dataset-popup-identity";
      root.replaceChildren(layer, title);
      if (back) root.append(button("Voltar ao agrupamento", back));
      root.append(
        fields.children.length
          ? fields
          : element("p", "Nenhum atributo disponível para este acesso."),
        identity,
      );
    } catch (cause) {
      if (signal.aborted) return;
      error(current, () => void showFeature(datasetId, featureId, back));
      void cause;
    }
  }

  function showCluster(datasetId: string, z: number, cellX: number, cellY: number, count: number) {
    let cursor: string | null = null;
    const { current } = start(`${count.toLocaleString("pt-BR")} pontos agrupados`);
    const list = element("div");
    const status = element("p", "Carregando pontos…");
    const more = button("Carregar mais pontos", () => void load());
    const back = () => showCluster(datasetId, z, cellX, cellY, count);
    root.replaceChildren(
      element("p", layerName),
      element("h3", `${count.toLocaleString("pt-BR")} pontos agrupados`),
      list,
      status,
    );

    async function load() {
      request?.abort();
      request = new AbortController();
      const signal = request.signal;
      more.disabled = true;
      status.textContent = "Carregando pontos…";
      try {
        const query = new URLSearchParams({
          z: String(z),
          cellX: String(cellX),
          cellY: String(cellY),
          pageSize: "40",
        });
        if (cursor) query.set("cursor", cursor);
        const result = await apiFetch<DatasetMapClusterMembers>(
          `/datasets/${encodeURIComponent(datasetId)}/map-cluster-features?${query}`,
          { signal },
        );
        if (disposed || current !== revision) return;
        for (const feature of result.features) {
          list.append(button(feature.title, () => void showFeature(datasetId, feature.id, back)));
        }
        cursor = result.nextCursor;
        status.textContent = cursor
          ? "Há mais pontos neste agrupamento."
          : "Todos os pontos deste agrupamento foram listados.";
        if (cursor) root.append(more);
        else more.remove();
      } catch {
        if (signal.aborted || disposed || current !== revision) return;
        status.textContent = "Não foi possível carregar os pontos.";
        more.textContent = "Tentar novamente";
        root.append(more);
      } finally {
        more.disabled = false;
      }
    }
    void load();
  }

  return { showFeature, showCluster };
}
