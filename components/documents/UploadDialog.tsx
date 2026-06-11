"use client";

// Document upload dialog. Wraps a Radix Dialog around a multipart form. The
// parent owns the open/close state and the post-upload refresh callback.
//
// Parameterized so non-document flows (e.g. admin dispute attachments) can
// reuse it: `endpoint`, `accept`, `allowedTypes`/`showExpiresAt` (omit to hide
// the meta fields) and `labels` (i18n overrides). All defaults preserve the
// original /api/documents behavior.

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

// Every visible string; callers pass translated overrides via `labels`.
export type UploadDialogLabels = {
  title: string;
  description: string;
  typeLabel: string;
  expiresLabel: string;
  fileLabel: string;
  cancel: string;
  submit: string;
  close: string;
  errorNoFile: string;
  errorTooLarge: string;
};

const DEFAULT_LABELS: UploadDialogLabels = {
  title: "Upload document",
  description: "PDF, JPEG, PNG, or DOCX. Maximum 10 MB.",
  typeLabel: "Type",
  expiresLabel: "Expires at (optional)",
  fileLabel: "File",
  cancel: "Cancel",
  submit: "Upload",
  close: "Close",
  errorNoFile: "Please choose a file",
  errorTooLarge: "File too large (max 10 MB)",
};

const DEFAULT_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type UploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Limit which document types the role can upload. Omit (or pass an empty
  // array) to hide the type select entirely — no `type` field is sent then.
  allowedTypes?: ReadonlyArray<(typeof DOCUMENT_TYPES)[number]>;
  onUploaded: () => void;
  // Multipart POST target. Defaults to the document wallet endpoint.
  endpoint?: string;
  // `accept` attribute for the file input.
  accept?: string;
  // Show the optional expiry date field (document-wallet specific).
  showExpiresAt?: boolean;
  labels?: Partial<UploadDialogLabels>;
};

const MAX_BYTES = 10 * 1024 * 1024;

export function UploadDialog({
  open,
  onOpenChange,
  allowedTypes,
  onUploaded,
  endpoint = "/api/documents",
  accept = DEFAULT_ACCEPT,
  showExpiresAt = true,
  labels,
}: UploadDialogProps): React.ReactElement {
  const l: UploadDialogLabels = { ...DEFAULT_LABELS, ...labels };
  const hasTypes = (allowedTypes?.length ?? 0) > 0;
  const [type, setType] = React.useState<(typeof DOCUMENT_TYPES)[number]>(
    allowedTypes?.[0] ?? "OTHER",
  );
  const [expiresAt, setExpiresAt] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset form whenever the dialog opens.
  React.useEffect(() => {
    if (open) {
      setType(allowedTypes?.[0] ?? "OTHER");
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
      setError(l.errorNoFile);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(l.errorTooLarge);
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (hasTypes) fd.set("type", type);
      if (showExpiresAt && expiresAt) fd.set("expiresAt", expiresAt);
      fd.set("file", file);
      const res = await fetch(endpoint, {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const json = (await res.json()) as
        | { ok: true }
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
            <Dialog.Title className="text-lg font-semibold">{l.title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                aria-label={l.close}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="pb-4 text-sm text-muted-foreground">
            {l.description}
          </Dialog.Description>

          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            {hasTypes ? (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{l.typeLabel}</span>
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as (typeof DOCUMENT_TYPES)[number])
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  {(allowedTypes ?? []).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {showExpiresAt ? (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{l.expiresLabel}</span>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{l.fileLabel}</span>
              <Input
                type="file"
                accept={accept}
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={submitting}>
                  {l.cancel}
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {l.submit}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
