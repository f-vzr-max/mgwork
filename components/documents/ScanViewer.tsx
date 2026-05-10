"use client";

// Minimal in-app scan viewer. Embeds the signed URL inside an <iframe> with
// CSS-driven zoom and rotate. We deliberately avoid pulling pdf.js for this
// first version — modern browsers natively render PDF in <iframe>, and
// images render fine. If/when annotation, page-by-page navigation, or
// password-protected PDFs become a requirement, swap in pdf.js.
//
// The component does NOT request the URL itself; the caller passes a
// short-lived signed URL obtained via /api/documents/[id]/signed-url.

import * as React from "react";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ScanViewerProps = {
  url: string;
  // Optional MIME hint so the viewer can pick <img> vs <iframe>; we default
  // to iframe since it works for PDF + image.
  mime?: string;
  className?: string;
};

const ZOOM_STEP = 0.2;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3;

export function ScanViewer({ url, mime, className }: ScanViewerProps): React.ReactElement {
  const [zoom, setZoom] = React.useState(1);
  const [rotate, setRotate] = React.useState(0);

  const isImage = (mime ?? "").startsWith("image/");

  const transform = `rotate(${rotate}deg) scale(${zoom})`;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="min-w-[3rem] text-center text-xs tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRotate((r) => (r + 90) % 360)}
          aria-label="Rotate"
        >
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative h-[640px] w-full overflow-auto rounded-md border border-border bg-muted">
        <div
          className="origin-center transition-transform"
          style={{ transform, transformOrigin: "center center" }}
        >
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="Document scan"
              className="block h-auto max-w-full"
            />
          ) : (
            <iframe
              src={url}
              title="Document scan"
              className="h-[640px] w-full border-0 bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
}
