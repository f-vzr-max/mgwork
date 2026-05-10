"use client";

// Candidate document wallet — lists my documents with status + expiry
// indicators and lets me upload new ones. We intentionally keep this a
// client component for the v1 to keep state simple. A future server
// component can prefetch the initial list to avoid the loading flash.

import * as React from "react";
import { Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
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
        setError(`Failed to load documents (HTTP ${res.status})`);
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
    <>
      <PageHeader
        title="My documents"
        description="Manage your KYC documents — upload, track expiry, and respond to staff requests."
      >
        <Button variant="outline" size="sm" onClick={() => void fetchDocs()} disabled={loading}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4" />
          Upload
        </Button>
      </PageHeader>

      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Wallet</CardTitle>
            <CardDescription>
              Documents marked in red expire within 30 days; amber within 90 days.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pt-0">
            {error ? (
              <p className="px-4 py-3 text-sm text-rose-700">{error}</p>
            ) : null}
            {loading && docs == null ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>
            ) : docs && docs.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                No documents yet. Upload your passport and any work permits to get started.
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {(docs ?? []).map((d) => (
                  <DocumentRow key={d.id} doc={d} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        allowedTypes={CANDIDATE_TYPES}
        onUploaded={() => void fetchDocs()}
      />
    </>
  );
}
