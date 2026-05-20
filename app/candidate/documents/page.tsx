"use client";

// Candidate document wallet — mobile-first list. Reuses the existing
// `DocumentRow` (handles status pills + signed-URL view button) and
// `UploadDialog` (handles multipart upload to `/api/documents`). The wrapper
// here gives us the MG visual treatment: header copy, an inline upload CTA,
// and a Card around the row list.

import * as React from "react";
import { Button, Card, Icon, Stack } from "@/components/mg";
import { DocumentRow } from "@/components/documents/DocumentRow";
import { UploadDialog } from "@/components/documents/UploadDialog";
import type { DocumentDto } from "@/lib/documents";

const CANDIDATE_TYPES = [
  "PASSPORT",
  "MEDICAL_AUTHORIZATION",
  "WORK_PERMIT",
  "VISA",
  "OTHER",
] as const;

type ListResponse =
  | { ok: true; data: { items: DocumentDto[] } }
  | { ok: false; error: { message: string } };

export default function CandidateDocumentsPage(): React.ReactElement {
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
        setError(`Erreur de chargement (HTTP ${res.status})`);
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

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <Stack dir="row" justify="space-between" align="center">
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 className="mg-h1" style={{ margin: 0, fontSize: 26, lineHeight: "32px" }}>
            Mes documents
          </h1>
          <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
            Passeport, visite médicale, permis — gardés en sécurité.
          </div>
        </div>
        <Button
          size="sm"
          iconLeft="plus"
          onClick={() => setUploadOpen(true)}
        >
          Ajouter
        </Button>
      </Stack>

      <Card padding={0}>
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid hsl(var(--border))",
          }}
        >
          <div className="mg-h4" style={{ margin: 0 }}>Mon portefeuille</div>
          <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
            Rouge = expire dans 30 jours · Orange = dans 90 jours.
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 16px",
              borderBottom: "1px solid hsl(var(--border))",
              background: "var(--destructive-bg)",
              color: "hsl(var(--destructive))",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {loading && docs == null ? (
          <EmptyState
            icon="circle-dashed"
            title="Chargement…"
            hint="Récupération de vos documents."
          />
        ) : docs && docs.length === 0 ? (
          <EmptyState
            icon="file-text"
            title="Aucun document"
            hint="Ajoutez votre passeport et vos permis pour commencer."
            action={
              <Button size="sm" variant="outline" iconLeft="upload" onClick={() => setUploadOpen(true)}>
                Téléverser
              </Button>
            }
          />
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {(docs ?? []).map((d) => (
              <DocumentRow key={d.id} doc={d} />
            ))}
          </ul>
        )}
      </Card>

      <Button
        variant="ghost"
        size="sm"
        iconLeft="circle-dashed"
        onClick={() => void fetchDocs()}
        disabled={loading}
        style={{ alignSelf: "center" }}
      >
        Rafraîchir
      </Button>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        allowedTypes={CANDIDATE_TYPES}
        onUploaded={() => void fetchDocs()}
      />
    </div>
  );
}

function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: React.ComponentProps<typeof Icon>["name"];
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "32px 16px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 9999,
          background: "hsl(var(--surface-2))",
          color: "hsl(var(--muted-foreground))",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={18} />
      </div>
      <div className="mg-h4" style={{ margin: 0 }}>{title}</div>
      <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>{hint}</div>
      {action}
    </div>
  );
}
