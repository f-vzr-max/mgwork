"use client";

// Per-dispute attachments cell — sits at the bottom of each Kanban card.
// Shows the attachment count (server-seeded), lazily fetches the list with
// signed URLs on expand, and opens the shared UploadDialog pointed at the
// admin attachments endpoint. Colocated with the page (not a route file).

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, Stack } from "@/components/mg";
import { UploadDialog } from "@/components/documents/UploadDialog";

type AttachmentItem = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string | null;
  urlExpiresAt: string | null;
};

type ListResponse =
  | { ok: true; data: { items: AttachmentItem[] } }
  | { ok: false; error: { message: string } };

export function DisputeAttachmentsCell({
  checkpointId,
  initialCount,
}: {
  checkpointId: string;
  initialCount: number;
}): React.ReactElement {
  const t = useTranslations("app.admin.disputeAttachments");
  const [count, setCount] = React.useState(initialCount);
  const [items, setItems] = React.useState<AttachmentItem[] | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);

  const endpoint = `/api/admin/disputes/${checkpointId}/attachments`;

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { credentials: "same-origin" });
      const json = (await res.json()) as ListResponse;
      if (!res.ok || !json.ok) {
        setError(t("loadError"));
        return;
      }
      setItems(json.data.items);
      setCount(json.data.items.length);
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [endpoint, t]);

  function toggleList() {
    const next = !expanded;
    setExpanded(next);
    if (next && items == null) void fetchItems();
  }

  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop: "1px solid hsl(var(--border))",
      }}
    >
      <Stack dir="row" justify="space-between" align="center">
        <button
          type="button"
          onClick={toggleList}
          className="mg-caption"
          style={{
            border: 0,
            background: "transparent",
            color: "hsl(var(--muted-foreground))",
            padding: 0,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Icon name="paperclip" size={14} />
          {t("count", { count })}
          <Icon name={expanded ? "chevron-up" : "chevron-down"} size={12} />
        </button>
        <Button
          size="sm"
          variant="ghost"
          iconLeft="plus"
          onClick={() => setUploadOpen(true)}
        >
          {t("add")}
        </Button>
      </Stack>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
          {loading && items == null ? (
            <span
              className="mg-caption"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              {t("loading")}
            </span>
          ) : error ? (
            <span className="mg-caption" style={{ color: "hsl(var(--destructive))" }}>
              {error}
            </span>
          ) : (
            (items ?? []).map((a) =>
              a.url ? (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mg-caption"
                  style={{
                    color: "hsl(var(--primary))",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.filename}
                </a>
              ) : (
                <span
                  key={a.id}
                  className="mg-caption"
                  style={{
                    color: "hsl(var(--muted-foreground))",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.filename}
                </span>
              ),
            )
          )}
        </div>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => {
          setExpanded(true);
          void fetchItems();
        }}
        endpoint={endpoint}
        showExpiresAt={false}
        labels={{
          title: t("dialogTitle"),
          description: t("dialogDescription"),
          fileLabel: t("fileLabel"),
          cancel: t("cancel"),
          submit: t("submit"),
          close: t("close"),
          errorNoFile: t("errorNoFile"),
          errorTooLarge: t("errorTooLarge"),
        }}
      />
    </div>
  );
}
