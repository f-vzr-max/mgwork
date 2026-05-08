"use client";

import { useEffect, useState } from "react";

// Lightweight client-side viewer that fetches a 15-min signed URL for the
// given document and embeds it via <iframe>. This is a fallback used by
// the staff review page when the dedicated <ScanViewer /> component (built
// by docs-coder) is not yet present. The signed URL endpoint is owned by
// docs-coder (M3) — when it exists, this component will work as-is.
//
// We intentionally do not server-side render the URL: signed URLs are
// short-lived and tied to the staff session, so issuing them on demand
// keeps the surface area minimal and audit logs accurate.

type SignedUrlResponse = {
  ok?: boolean;
  data?: { url: string; expiresAt: string };
  error?: string;
} | null;

export function InlineScanViewer({ documentId }: { documentId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/signed-url`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          if (cancelled) return;
          if (res.status === 404) {
            setError("Signed URL endpoint not available yet.");
          } else {
            setError(`Could not load preview (${res.status}).`);
          }
          setLoading(false);
          return;
        }
        const json = (await res.json()) as SignedUrlResponse;
        if (cancelled) return;
        const signed = json?.data?.url ?? null;
        if (!signed) {
          setError("Signed URL response was empty.");
        } else {
          setUrl(signed);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (loading) {
    return (
      <div className="flex h-[480px] items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        Loading preview...
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="flex h-[480px] flex-col items-center justify-center gap-2 rounded-md border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        <p>{error ?? "No preview available."}</p>
        <p className="text-xs">You can still approve or reject below using the document metadata.</p>
      </div>
    );
  }

  return (
    <iframe
      src={url}
      title={`Document ${documentId}`}
      className="h-[640px] w-full rounded-md border bg-white"
    />
  );
}
