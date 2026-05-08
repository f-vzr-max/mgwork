"use client";

// Enterprise onboarding — multi-step form.
//
// Steps: company → KYC → contact. Submission posts to /api/enterprises and
// redirects to /enterprise.

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
import { EnterpriseStepCompany } from "@/components/onboarding/EnterpriseStepCompany";
import { EnterpriseStepKyc } from "@/components/onboarding/EnterpriseStepKyc";
import { EnterpriseStepContact } from "@/components/onboarding/EnterpriseStepContact";
import {
  ENTERPRISE_FORM_DEFAULTS,
  type EnterpriseFormValues,
} from "@/components/onboarding/enterprise-form-values";

const stepSchemas = [
  // Step 1: company
  z
    .object({
      companyName: z.string().trim().min(1, "Required").max(240),
      sector: z.string().trim().max(80).optional().or(z.literal("")),
      address: z.string().trim().max(400).optional().or(z.literal("")),
      plan: z.enum(["FREE", "STARTER", "PRO"]),
    })
    .passthrough(),
  // Step 2: KYC
  z
    .object({
      registrationNumber: z
        .string()
        .trim()
        .max(80)
        .optional()
        .or(z.literal("")),
    })
    .passthrough(),
  // Step 3: contact
  z
    .object({
      contactName: z.string().trim().max(120).optional().or(z.literal("")),
      contactPhone: z
        .string()
        .trim()
        .regex(/^\+?[0-9 .\-()]{6,30}$/, "Invalid phone")
        .optional()
        .or(z.literal("")),
    })
    .passthrough(),
];

const STEPS = [
  { key: "company", label: "Company" },
  { key: "kyc", label: "KYC" },
  { key: "contact", label: "Contact" },
] as const;

export default function EnterpriseOnboardingPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const stepResolver = zodResolver(
    stepSchemas[stepIndex],
  ) as unknown as Resolver<EnterpriseFormValues>;

  const form = useForm<EnterpriseFormValues>({
    defaultValues: ENTERPRISE_FORM_DEFAULTS,
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
      companyName: v.companyName,
      plan: v.plan,
    };
    if (v.registrationNumber) payload.registrationNumber = v.registrationNumber;
    if (v.sector) payload.sector = v.sector;
    if (v.address) payload.address = v.address;
    if (v.contactName) payload.contactName = v.contactName;
    if (v.contactPhone) payload.contactPhone = v.contactPhone;

    setSubmitting(true);
    try {
      const res = await fetch("/api/enterprises", {
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
      router.push("/enterprise");
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
            <CardTitle>Enterprise onboarding</CardTitle>
            <CardDescription>
              A few details and we&apos;ll set up your hiring workspace.
            </CardDescription>
          </div>
          <Stepper steps={[...STEPS]} currentIndex={stepIndex} />
        </CardHeader>
        <CardContent className="space-y-6">
          {stepIndex === 0 && <EnterpriseStepCompany form={form} />}
          {stepIndex === 1 && <EnterpriseStepKyc form={form} />}
          {stepIndex === 2 && <EnterpriseStepContact form={form} />}

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
