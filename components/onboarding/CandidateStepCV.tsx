"use client";

// Candidate onboarding — step 5: CV upload (optional).
//
// The actual upload to Supabase Storage is owned by M3 (docs-coder). For M2
// onboarding we accept a file, optionally call /api/ai/extract-cv to pre-fill
// candidate fields, and stash the file URL on the form once an upload route
// becomes available. While that route is missing the user can still finish
// onboarding without a CV.
//
// We treat the AI extract endpoint as best-effort — a 404 in dev simply skips
// the auto-fill; the rest of the flow is unaffected.

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { CandidateFormValues } from "./candidate-form-values";
import type { CvExtractResult } from "@/types/api";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

export type CandidateStepCVProps = {
  form: UseFormReturn<CandidateFormValues>;
};

type Status =
  | { kind: "idle" }
  | { kind: "extracting" }
  | { kind: "extracted"; fields: CvExtractResult }
  | { kind: "skipped"; reason: string };

async function tryExtract(file: File): Promise<CvExtractResult | null> {
  // Best-effort — endpoint may not be deployed yet (M5).
  try {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/ai/extract-cv", { method: "POST", body: fd });
    if (!res.ok) return null;
    const json = (await res.json()) as
      | { ok: true; data: CvExtractResult }
      | { ok: false };
    if (!json.ok) return null;
    return json.data;
  } catch {
    return null;
  }
}

export function CandidateStepCV({ form }: CandidateStepCVProps) {
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const [file, setFile] = React.useState<File | null>(null);

  async function onFile(f: File | null) {
    setFile(f);
    if (!f) {
      setStatus({ kind: "idle" });
      return;
    }
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setStatus({ kind: "skipped", reason: "Unsupported file type" });
      return;
    }
    if (f.size > MAX_FILE_SIZE_BYTES) {
      setStatus({ kind: "skipped", reason: "File too large (max 10 MB)" });
      return;
    }

    setStatus({ kind: "extracting" });
    const fields = await tryExtract(f);
    if (!fields) {
      setStatus({ kind: "skipped", reason: "AI extract unavailable; you can still finish without it" });
      return;
    }

    // Pre-fill any empty fields. Don't overwrite user-entered values.
    const cur = form.getValues();
    if (!cur.firstName && fields.firstName) form.setValue("firstName", fields.firstName);
    if (!cur.lastName && fields.lastName) form.setValue("lastName", fields.lastName);

    if (fields.skills?.length) {
      const merged = Array.from(
        new Set([...(cur.skills ?? []), ...fields.skills].map((s) => s.trim()).filter(Boolean)),
      ).slice(0, 50);
      form.setValue("skills", merged, { shouldDirty: true });
    }
    if (fields.sectors?.length) {
      const merged = Array.from(
        new Set([...(cur.sectors ?? []), ...fields.sectors].map((s) => s.trim()).filter(Boolean)),
      ).slice(0, 20);
      form.setValue("sectors", merged, { shouldDirty: true });
    }
    if (fields.languages?.length) {
      const fr = fields.languages.find((l) => l.code === "FR");
      const en = fields.languages.find((l) => l.code === "EN");
      if (fr && cur.langScoreFR === undefined) form.setValue("langScoreFR", fr.selfLevel);
      if (en && cur.langScoreEN === undefined) form.setValue("langScoreEN", en.selfLevel);
    }

    setStatus({ kind: "extracted", fields });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload your CV (optional). PDF, PNG, JPG or WEBP — up to 10 MB. We&apos;ll
        try to pre-fill your profile from it.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            void onFile(f);
          }}
        />
        {file && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setFile(null);
              setStatus({ kind: "idle" });
            }}
          >
            Remove
          </Button>
        )}
      </div>

      {status.kind === "extracting" && (
        <p className="text-xs text-muted-foreground">Reading your CV…</p>
      )}
      {status.kind === "extracted" && (
        <p className="text-xs text-brand-green">
          Pre-filled {status.fields.skills?.length ?? 0} skills and{" "}
          {status.fields.sectors?.length ?? 0} sectors from your CV. Review the
          earlier steps before submitting.
        </p>
      )}
      {status.kind === "skipped" && (
        <p className="text-xs text-muted-foreground">{status.reason}</p>
      )}
    </div>
  );
}
