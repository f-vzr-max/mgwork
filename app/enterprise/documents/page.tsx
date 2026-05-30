"use client";

// MG Work — Enterprise document wallet (KYC).
//
// Same logic as the previous version (fetches /api/documents and renders the
// shared <DocumentRow />) but dressed in MG primitives so it matches the rest
// of the enterprise area chrome.

import * as React from "react";
import { useTranslations } from "next-intl";

import { Badge, Button, Card, Hairline, PageHeader, Stack } from "@/components/mg";
import { DocumentRow } from "@/components/documents/DocumentRow";
import { UploadDialog } from "@/components/documents/UploadDialog";
import type { DocumentDto } from "@/lib/documents";

const ENTERPRISE_TYPES = ["INCORPORATION_CERTIFICATE", "OTHER"] as const;

type ListResponse =
  | { ok: true; data: { items: DocumentDto[] } }
  | { ok: false; error: { message: string } };

export default function EnterpriseDocumentsPage(): React.ReactElement {
  const t = useTranslations("app.enterprise");
  const [docs, setDocs] = React.useState<DocumentDto[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);

  const fetchDocs = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/documents", { credentials: "same-origin" });
      if (!res.ok) {
        setError(t("documents.error.loadFailed", { status: res.status }));
        setDocs([]);
        return;
      }
      const json = (await res.json()) as ListResponse;
      if (!json.ok) {
        setError(json.error.message);
        setDocs([]);
        return;
      }
      setDocs(json.data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  const approved = docs?.filter((d) => d.status === "APPROVED").length ?? 0;
  const pending = docs?.filter((d) => d.status === "PENDING").length ?? 0;
  const rejected = docs?.filter((d) => d.status === "REJECTED").length ?? 0;

  return (
    <>
      <PageHeader
        title={t("documents.title")}
        subtitle={t("documents.subtitle")}
        action={
          <Stack dir="row" gap={8}>
            <Button
              variant="outline"
              iconLeft="upload"
              onClick={() => void fetchDocs()}
              disabled={loading}
            >
              {t("documents.actions.refresh")}
            </Button>
            <Button iconLeft="plus" onClick={() => setUploadOpen(true)}>
              {t("documents.actions.upload")}
            </Button>
          </Stack>
        }
      />

      <div style={{ padding: "0 32px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
        <Card padding={0}>
          <div
            style={{
              padding: "14px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h3 className="mg-h4" style={{ margin: 0 }}>
                {t("documents.wallet.title")}
              </h3>
              <div
                className="mg-caption"
                style={{ color: "hsl(var(--muted-foreground))", marginTop: 2 }}
              >
                {t("documents.wallet.legend")}
              </div>
            </div>
            <Stack dir="row" gap={6}>
              <Badge tone="success" size="md">
                {t("documents.badges.approved", { count: approved })}
              </Badge>
              <Badge tone="warning" size="md">
                {t("documents.badges.pending", { count: pending })}
              </Badge>
              <Badge tone="danger" size="md">
                {t("documents.badges.rejected", { count: rejected })}
              </Badge>
            </Stack>
          </div>
          <Hairline />
          {error ? (
            <p
              className="mg-body-sm"
              style={{ padding: "12px 20px", color: "hsl(var(--destructive))" }}
            >
              {error}
            </p>
          ) : null}
          {loading && docs == null ? (
            <p
              className="mg-body-sm"
              style={{ padding: "16px 20px", color: "hsl(var(--muted-foreground))" }}
            >
              {t("documents.state.loading")}
            </p>
          ) : docs && docs.length === 0 ? (
            <p
              className="mg-body-sm"
              style={{ padding: "16px 20px", color: "hsl(var(--muted-foreground))" }}
            >
              {t("documents.state.empty")}
            </p>
          ) : (
            <ul className="m-0 list-none p-0" style={{ margin: 0, padding: 0 }}>
              {(docs ?? []).map((d) => (
                <DocumentRow key={d.id} doc={d} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        allowedTypes={ENTERPRISE_TYPES}
        onUploaded={() => void fetchDocs()}
      />
    </>
  );
}
