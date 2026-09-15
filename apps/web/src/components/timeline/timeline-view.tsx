"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { TimelineJsonDTO } from "@geo/shared";
import { PdfViewer } from "./pdf-viewer";

declare global {
  interface Window {
    TL?: {
      Timeline: new (
        container: HTMLElement,
        data: TimelineJsonDTO,
        options?: Record<string, unknown>,
      ) => { destroy?: () => void };
    };
  }
}

const CSS_HREFS = [
  "/vendor/timelinejs/css/timeline.css",
  "/vendor/timelinejs/timeline-theme-system.css",
];
const SCRIPT_SRC = "/vendor/timelinejs/js/timeline.js";

function ensureCss() {
  for (const href of CSS_HREFS) {
    if (document.querySelector(`link[href="${href}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
}

let scriptPromise: Promise<void> | null = null;
function ensureScript(): Promise<void> {
  if (window.TL) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar TimelineJS"));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

interface TimelineViewProps {
  data: TimelineJsonDTO;
}

export function TimelineView({ data }: TimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;
    const pdfRoots: Root[] = [];

    ensureCss();
    ensureScript().then(() => {
      if (cancelled || !containerRef.current || !window.TL) return;
      containerRef.current.innerHTML = "";
      new window.TL.Timeline(containerRef.current, data, { initial_zoom: 2 });

      // TimelineJS embeda PDF num <iframe> apontando pro viewer nativo do browser
      // (barra escura do Chrome). Substituímos por um viewer próprio (pdf.js) no
      // estilo do sistema assim que o iframe aparece no DOM.
      const replaceIfPdf = (iframe: HTMLIFrameElement) => {
        if (iframe.dataset.pdfHandled) return;
        const src = iframe.getAttribute("src") ?? "";
        if (!src.toLowerCase().includes(".pdf")) return;
        iframe.dataset.pdfHandled = "true";
        const mount = document.createElement("div");
        mount.className = "h-full w-full";
        iframe.replaceWith(mount);
        const root = createRoot(mount);
        root.render(<PdfViewer url={src} />);
        pdfRoots.push(root);
      };

      const scan = (node: ParentNode) => {
        node.querySelectorAll<HTMLIFrameElement>("iframe").forEach(replaceIfPdf);
      };
      scan(containerRef.current);

      observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "attributes" && mutation.target instanceof HTMLIFrameElement) {
            replaceIfPdf(mutation.target);
          }
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            if (node instanceof HTMLIFrameElement) replaceIfPdf(node);
            scan(node);
          });
        }
      });
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src"],
      });
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      // unmount() precisa rodar fora do ciclo síncrono de cleanup do React —
      // chamado direto aqui, ele pode coincidir com um render em andamento
      // (ex: troca rápida de filtro) e o React acusa "unmount enquanto renderiza".
      setTimeout(() => {
        pdfRoots.forEach((root) => root.unmount());
      }, 0);
    };
  }, [data]);

  return (
    <div className="h-full w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
