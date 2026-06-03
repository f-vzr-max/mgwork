"use client";

// Candidate onboarding — multi-step form.
//
// Steps: identity → languages → skills → sectors → CV upload (optional).
// Each step is its own component (components/onboarding/CandidateStep*.tsx).
// Submission posts to /api/candidates and redirects to /candidate.
//
// Drafts are persisted server-side via /api/onboarding/draft so the user can
// resume on another browser or device. The draft is dropped after a successful
// final submit.

import * as React from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/onboarding/Stepper";
import { CandidateStepIdentity } from "@/components/onboarding/CandidateStepIdentity";
import { CandidateStepLanguages } from "@/components/onboarding/CandidateStepLanguages";
import { CandidateStepSkills } from "@/components/onboarding/CandidateStepSkills";
import { CandidateStepSectors } from "@/components/onboarding/CandidateStepSectors";
import { CandidateStepCV } from "@/components/onboarding/CandidateStepCV";
import {
  CANDIDATE_FORM_DEFAULTS,
  type CandidateFormValues,
} from "@/components/onboarding/candidate-form-values";

// Reject DOBs less than 18 years before today. The same check runs server-side
// in lib/validation/candidate.ts; this client mirror just gives faster errors.
const isAtLeast18Iso = (v: string): boolean => {
  if (!v) return true;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return false;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 18);
  return d.getTime() <= cutoff.getTime();
};

// Mirror of the server-side input gate (lib/validation/candidate.ts): accept
// Madagascar (+261) and Mauritius (+230) country codes, or a trunk-0 / bare
// number. Kept in sync so the client never rejects a number the server accepts.
const PHONE_INPUT_RE = /^(\+261|\+230|0)?[\s.\-()]*[0-9](?:[\s.\-()]*[0-9]){5,12}$/;

// Per-step validation schema. The full server-side schema lives in
// lib/validation/candidate.ts; here we only validate fields the user can see.
const stepSchemas = [
  // Step 1: identity
  z
    .object({
      firstName: z.string().trim().min(1, "Champ requis").max(120),
      lastName: z.string().trim().min(1, "Champ requis").max(120),
      dateOfBirth: z
        .string()
        .optional()
        .or(z.literal(""))
        .refine((v) => !v || isAtLeast18Iso(v), {
          message: "Vous devez avoir au moins 18 ans",
        }),
      phone: z
        .string()
        .trim()
        .regex(PHONE_INPUT_RE, "Numéro invalide")
        .optional()
        .or(z.literal("")),
      city: z.string().trim().max(120).optional().or(z.literal("")),
      bio: z.string().trim().max(2000).optional().or(z.literal("")),
    })
    .passthrough(),
  // Step 2: languages
  z
    .object({
      langScoreFR: z.number().int().min(0).max(100).optional(),
      langScoreEN: z.number().int().min(0).max(100).optional(),
    })
    .passthrough(),
  // Step 3: skills
  z
    .object({
      skills: z.array(z.string().min(1).max(80)).max(50),
    })
    .passthrough(),
  // Step 4: sectors
  z
    .object({
      sectors: z.array(z.string().min(1).max(80)).max(20),
    })
    .passthrough(),
  // Step 5: CV (optional)
  z
    .object({
      cvFileUrl: z.string().url().optional().or(z.literal("")),
    })
    .passthrough(),
];

type DraftEnvelope =
  | {
      ok: true;
      data: {
        draft:
          | {
              stepIndex: number;
              data: Partial<CandidateFormValues>;
              role: "CANDIDATE" | "ENTERPRISE";
              updatedAt: string;
            }
          | null;
      };
    }
  | { ok: false };

export default function CandidateOnboardingPage() {
  const router = useRouter();
  const { session } = useClerk();
  const t = useTranslations();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [restored, setRestored] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  const STEPS = [
    { key: "identity", label: t("onboarding.candidate.identity") },
    { key: "languages", label: t("onboarding.candidate.languages") },
    { key: "skills", label: t("onboarding.candidate.skills") },
    { key: "sectors", label: t("onboarding.candidate.sectors") },
    { key: "cv", label: t("onboarding.candidate.cv") },
  ] as const;

  // The per-step resolver is intentionally a partial schema; we cast to the
  // full form's resolver type so RHF's generic stays consistent across steps.
  const stepResolver = zodResolver(
    stepSchemas[stepIndex],
  ) as unknown as Resolver<CandidateFormValues>;

  const form = useForm<CandidateFormValues>({
    defaultValues: CANDIDATE_FORM_DEFAULTS,
    resolver: stepResolver,
    mode: "onTouched",
  });

  const isLast = stepIndex === STEPS.length - 1;

  // --- Draft restore on mount ----------------------------------------------
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/draft", { method: "GET" });
        if (!res.ok) return;
        const json = (await res.json()) as DraftEnvelope;
        if (!json.ok || cancelled) return;
        const draft = json.data.draft;
        if (!draft || draft.role !== "CANDIDATE") return;
        form.reset({ ...CANDIDATE_FORM_DEFAULTS, ...draft.data });
        setStepIndex(Math.min(draft.stepIndex, STEPS.length - 1));
        setRestored(true);
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // We only want this to run on mount; form is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Save helpers --------------------------------------------------------
  const saveDraft = React.useCallback(
    async (idx: number) => {
      try {
        const data = form.getValues();
        await fetch("/api/onboarding/draft", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepIndex: idx, data }),
        });
      } catch {
        // non-blocking: drafts are convenience, not correctness.
      }
    },
    [form],
  );

  // Debounced auto-save on form change (post-hydration only).
  React.useEffect(() => {
    if (!hydrated) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = form.watch(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void saveDraft(stepIndex);
      }, 1200);
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.unsubscribe();
    };
  }, [form, hydrated, stepIndex, saveDraft]);

  async function next() {
    const valid = await form.trigger();
    if (!valid) return;
    const newIdx = Math.min(stepIndex + 1, STEPS.length - 1);
    setStepIndex(newIdx);
    void saveDraft(newIdx);
  }

  function back() {
    const newIdx = Math.max(stepIndex - 1, 0);
    setStepIndex(newIdx);
    void saveDraft(newIdx);
  }

  async function restart() {
    try {
      await fetch("/api/onboarding/draft", { method: "DELETE" });
    } catch {
      // ignore
    }
    form.reset(CANDIDATE_FORM_DEFAULTS);
    setStepIndex(0);
    setRestored(false);
  }

  async function submit() {
    setSubmitError(null);
    const valid = await form.trigger();
    if (!valid) return;

    const v = form.getValues();
    const payload: Record<string, unknown> = {
      firstName: v.firstName,
      lastName: v.lastName,
      skills: v.skills ?? [],
      sectors: v.sectors ?? [],
    };
    if (v.dateOfBirth) payload.dateOfBirth = v.dateOfBirth;
    if (v.phone) payload.phone = v.phone;
    if (v.city) payload.city = v.city;
    if (v.bio) payload.bio = v.bio;
    if (v.langScoreFR !== undefined) payload.langScoreFR = v.langScoreFR;
    if (v.langScoreEN !== undefined) payload.langScoreEN = v.langScoreEN;
    if (v.cvFileUrl) payload.cvFileUrl = v.cvFileUrl;

    setSubmitting(true);
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { ok: false; error: { message?: string } }
          | null;
        setSubmitError(
          body?.error?.message ??
            t("onboarding.errors.submitFailedFmt", { status: res.status }),
        );
        setSubmitting(false);
        return;
      }
      // Drop the draft now that we've persisted the real Candidate row.
      void fetch("/api/onboarding/draft", { method: "DELETE" });
      // Reload the Clerk session so the middleware sees the fresh role in JWT
      // claims before we navigate; without this the middleware bounces /candidate
      // back to /onboarding because the JWT still carries the pre-onboarding state.
      await session?.reload();
      router.push("/candidate");
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : t("onboarding.errors.networkError"),
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-3xl">
        <CardHeader className="space-y-4">
          <div>
            <CardTitle>{t("onboarding.candidate.cardTitle")}</CardTitle>
            <CardDescription>
              {t("onboarding.candidate.cardDescription")}
            </CardDescription>
          </div>
          <Stepper steps={[...STEPS]} currentIndex={stepIndex} />
          {restored && (
            <div className="flex items-start justify-between gap-3 rounded-md border border-brand-blue/30 bg-brand-blue/5 p-3 text-xs text-foreground">
              <span>{t("onboarding.banner.restored")}</span>
              <button
                type="button"
                onClick={restart}
                className="shrink-0 underline hover:text-brand-blue"
              >
                {t("onboarding.banner.restart")}
              </button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {stepIndex === 0 && <CandidateStepIdentity form={form} />}
          {stepIndex === 1 && <CandidateStepLanguages form={form} />}
          {stepIndex === 2 && <CandidateStepSkills form={form} />}
          {stepIndex === 3 && <CandidateStepSectors form={form} />}
          {stepIndex === 4 && <CandidateStepCV form={form} />}

          {submitError && (
            <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {submitError}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={back}
              disabled={stepIndex === 0 || submitting}
            >
              {t("onboarding.buttons.previous")}
            </Button>
            {isLast ? (
              <Button type="button" onClick={submit} disabled={submitting}>
                {submitting
                  ? t("onboarding.buttons.saving")
                  : t("onboarding.buttons.finish")}
              </Button>
            ) : (
              <Button type="button" onClick={next} disabled={submitting}>
                {t("onboarding.buttons.next")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
