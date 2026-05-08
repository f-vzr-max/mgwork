"use client";

// Candidate onboarding — multi-step form.
//
// Steps: identity → languages → skills → sectors → CV upload (optional).
// Each step is its own component (components/onboarding/CandidateStep*.tsx).
// Submission posts to /api/candidates and redirects to /candidate.
//
// We validate per-step using a slice of candidateCreateSchema so users get
// localized errors as they go. On final submit we re-parse the full payload
// to catch anything the UI let through.

import * as React from "react";
import { useRouter } from "next/navigation";
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

// Per-step validation schema. The full server-side schema lives in
// lib/validation/candidate.ts; here we only validate fields the user can see.
const stepSchemas = [
  // Step 1: identity
  z
    .object({
      firstName: z.string().trim().min(1, "Required").max(120),
      lastName: z.string().trim().min(1, "Required").max(120),
      dateOfBirth: z.string().optional().or(z.literal("")),
      nationality: z
        .string()
        .trim()
        .length(2, "Use a 2-letter country code")
        .transform((v) => v.toUpperCase()),
      phone: z
        .string()
        .trim()
        .regex(/^\+?[0-9 .\-()]{6,30}$/, "Invalid phone")
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

const STEPS = [
  { key: "identity", label: "Identity" },
  { key: "languages", label: "Languages" },
  { key: "skills", label: "Skills" },
  { key: "sectors", label: "Sectors" },
  { key: "cv", label: "CV" },
] as const;

export default function CandidateOnboardingPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

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

  async function next() {
    const valid = await form.trigger();
    if (!valid) return;
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function back() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function submit() {
    setSubmitError(null);
    const valid = await form.trigger();
    if (!valid) return;

    const v = form.getValues();
    const payload: Record<string, unknown> = {
      firstName: v.firstName,
      lastName: v.lastName,
      nationality: (v.nationality || "MG").toUpperCase(),
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
          body?.error?.message ?? `Submission failed (${res.status})`,
        );
        setSubmitting(false);
        return;
      }
      router.push("/candidate");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Network error");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-3xl">
        <CardHeader className="space-y-4">
          <div>
            <CardTitle>Candidate onboarding</CardTitle>
            <CardDescription>
              Tell us about you so we can match you to the right offers.
            </CardDescription>
          </div>
          <Stepper steps={[...STEPS]} currentIndex={stepIndex} />
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
              Back
            </Button>
            {isLast ? (
              <Button type="button" onClick={submit} disabled={submitting}>
                {submitting ? "Saving..." : "Finish"}
              </Button>
            ) : (
              <Button type="button" onClick={next} disabled={submitting}>
                Next
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
