"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const WORKER_SRC = "/vendor/pdfjs/pdf.worker.min.mjs";

interface PdfViewerProps {
  url: string;
}

export function PdfViewer({ url }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<import("pdfjs-dist").PDFDocumentLoadingTask | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setPageNum(1);

    import("pdfjs-dist").then(async (pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
      const loadingTask = pdfjsLib.getDocument({ url });
      loadingTaskRef.current = loadingTask;
      try {
        const doc = await loadingTask.promise;
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    });

    return () => {
      cancelled = true;
      loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
      docRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    if (status !== "ready" || !docRef.current || !canvasRef.current) return;
    let cancelled = false;

    docRef.current.getPage(pageNum).then((page) => {
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      renderTaskRef.current?.cancel();
      const task = page.render({ canvas, canvasContext: context, viewport });
      renderTaskRef.current = task;
      task.promise.catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [status, pageNum, scale]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={pageNum <= 1}
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {status === "ready" ? `${pageNum} / ${numPages}` : "—"}
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={pageNum >= numPages}
            onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={scale <= 0.5}
            onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(1)))}
          >
            <ZoomOut />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={scale >= 2.5}
            onClick={() => setScale((s) => Math.min(2.5, +(s + 0.2).toFixed(1)))}
          >
            <ZoomIn />
          </Button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Abrir em nova aba"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-auto p-3">
        {status === "loading" && (
          <div className="flex h-full items-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {status === "error" && (
          <div className="flex h-full items-center text-sm text-muted-foreground">
            Não foi possível carregar o documento.{" "}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Abrir original
            </a>
          </div>
        )}
        <canvas ref={canvasRef} className="max-w-full shadow-sm" hidden={status !== "ready"} />
      </div>
    </div>
  );
}
