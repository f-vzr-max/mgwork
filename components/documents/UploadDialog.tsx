"use client";

// Document upload dialog. Wraps a Radix Dialog around a multipart form. The
// parent owns the open/close state and the post-upload refresh callback.

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DOCUMENT_TYPES } from "@/lib/validation/document";

const TYPE_LABELS: Record<(typeof DOCUMENT_TYPES)[number], string> = {
  PASSPORT: "Passport",
  MEDICAL_AUTHORIZATION: "Medical authorization",
  WORK_PERMIT: "Work permit",
  VISA: "Visa",
  INCORPORATION_CERTIFICATE: "Incorporation certificate",
  OTHER: "Other",
};

export type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Limit which document types the role can upload.
  allowedTypes: ReadonlyArray<(typeof DOCUMENT_TYPES)[number]>;
  onUploaded: () => void;
};

const MAX_BYTES = 10 * 1024 * 1024;

export function UploadDialog({
  open,
  onOpenChange,
  allowedTypes,
  onUploaded,
}: UploadDialogProps): React.ReactElement {
  const [type, setType] = React.useState<(typeof DOCUMENT_TYPES)[number]>(
    allowedTypes[0] ?? "OTHER",
  );
  const [expiresAt, setExpiresAt] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset form whenever the dialog opens.
  React.useEffect(() => {
    if (open) {
      setType(allowedTypes[0] ?? "OTHER");
      setExpiresAt("");
      setFile(null);
      setError(null);
      setSubmitting(false);
    }
  }, [open, allowedTypes]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Please choose a file");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File too large (max 10 MB)");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("type", type);
      if (expiresAt) fd.set("expiresAt", expiresAt);
      fd.set("file", file);
      const res = await fetch("/api/documents", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const json = (await res.json()) as
        | { ok: true; data: { documentId: string } }
        | { ok: false; error: { message: string } };
      if (!res.ok || !json.ok) {
        const msg = json && "error" in json ? json.error.message : `HTTP ${res.status}`;
        setError(msg);
        return;
      }
      onUploaded();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-lg border border-border bg-card p-6 shadow-xl",
          )}
        >
          <div className="flex items-start justify-between pb-2">
            <Dialog.Title className="text-lg font-semibold">Upload document</Dialog.Title>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="pb-4 text-sm text-muted-foreground">
            PDF, JPEG, PNG, or DOCX. Maximum 10 MB.
          </Dialog.Description>

          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Type</span>
              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value as (typeof DOCUMENT_TYPES)[number])
                }
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                required
              >
                {allowedTypes.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Expires at (optional)</span>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">File</span>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={submitting}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
