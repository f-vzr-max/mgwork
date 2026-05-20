"use client";

// MG Work — Enterprise document wallet (KYC).
//
// Same logic as the previous version (fetches /api/documents and renders the
// shared <DocumentRow />) but dressed in MG primitives so it matches the rest
// of the enterprise area chrome.

import * as React from "react";

import { Badge, Button, Card, Hairline, PageHeader, Stack } from "@/components/mg";
import { DocumentRow } from "@/components/documents/DocumentRow";
import { UploadDialog } from "@/components/documents/UploadDialog";
import type { DocumentDto } from "@/lib/documents";

const ENTERPRISE_TYPES = ["INCORPORATION_CERTIFICATE", "OTHER"] as const;

type ListResponse =
  | { ok: true; data: { items: DocumentDto[] } }
  | { ok: false; error: { message: string } };

export default function EnterpriseDocumentsPage(): React.ReactElement {
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
        setError(`Échec du chargement (HTTP ${res.status})`);
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
  }, []);

  React.useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  const approved = docs?.filter((d) => d.status === "APPROVED").length ?? 0;
  const pending = docs?.filter((d) => d.status === "PENDING").length ?? 0;
  const rejected = docs?.filter((d) => d.status === "REJECTED").length ?? 0;

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Pièces KYC et contrats. Suivez les échéances avant qu&apos;un client ne le demande."
        action={
          <Stack dir="row" gap={8}>
            <Button
              variant="outline"
              iconLeft="upload"
              onClick={() => void fetchDocs()}
              disabled={loading}
            >
              Actualiser
            </Button>
            <Button iconLeft="plus" onClick={() => setUploadOpen(true)}>
              Téléverser
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
                Portefeuille de documents
              </h3>
              <div
                className="mg-caption"
                style={{ color: "hsl(var(--muted-foreground))", marginTop: 2 }}
              >
                Rouge : expire sous 30 jours · Ambre : sous 90 jours
              </div>
            </div>
            <Stack dir="row" gap={6}>
              <Badge tone="success" size="md">
                Approuvés · {approved}
              </Badge>
              <Badge tone="warning" size="md">
                En attente · {pending}
              </Badge>
              <Badge tone="danger" size="md">
                Refusés · {rejected}
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
              Chargement…
            </p>
          ) : docs && docs.length === 0 ? (
            <p
              className="mg-body-sm"
              style={{ padding: "16px 20px", color: "hsl(var(--muted-foreground))" }}
            >
              Aucun document pour l&apos;instant. Téléversez votre certificat d&apos;incorporation
              pour démarrer la vérification.
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
