"use client";

// Enterprise onboarding — multi-step form.
//
// Steps: company → KYC → contact. Submission posts to /api/enterprises and
// redirects to /enterprise. Drafts are persisted via /api/onboarding/draft so
// the user can resume on another browser or device.

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
import { EnterpriseStepCompany } from "@/components/onboarding/EnterpriseStepCompany";
import { EnterpriseStepKyc } from "@/components/onboarding/EnterpriseStepKyc";
import { EnterpriseStepContact } from "@/components/onboarding/EnterpriseStepContact";
import {
  ENTERPRISE_FORM_DEFAULTS,
  type EnterpriseFormValues,
} from "@/components/onboarding/enterprise-form-values";

const PHONE_INPUT_RE = /^(\+261|0)?[\s.\-()]*[0-9](?:[\s.\-()]*[0-9]){5,12}$/;

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
        .regex(PHONE_INPUT_RE, "Invalid phone")
        .optional()
        .or(z.literal("")),
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
              data: Partial<EnterpriseFormValues>;
              role: "CANDIDATE" | "ENTERPRISE";
              updatedAt: string;
            }
          | null;
      };
    }
  | { ok: false };

export default function EnterpriseOnboardingPage() {
  const router = useRouter();
  const { session } = useClerk();
  const t = useTranslations();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [restored, setRestored] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  const STEPS = [
    { key: "company", label: t("onboarding.enterprise.company") },
    { key: "kyc", label: t("onboarding.enterprise.kyc") },
    { key: "contact", label: t("onboarding.enterprise.contact") },
  ] as const;

  const stepResolver = zodResolver(
    stepSchemas[stepIndex],
  ) as unknown as Resolver<EnterpriseFormValues>;

  const form = useForm<EnterpriseFormValues>({
    defaultValues: ENTERPRISE_FORM_DEFAULTS,
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
        if (!draft || draft.role !== "ENTERPRISE") return;
        form.reset({ ...ENTERPRISE_FORM_DEFAULTS, ...draft.data });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        // non-blocking
      }
    },
    [form],
  );

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
    form.reset(ENTERPRISE_FORM_DEFAULTS);
    setStepIndex(0);
    setRestored(false);
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
          body?.error?.message ??
            t("onboarding.errors.submitFailedFmt", { status: res.status }),
        );
        setSubmitting(false);
        return;
      }
      void fetch("/api/onboarding/draft", { method: "DELETE" });
      await session?.reload();
      router.push("/enterprise");
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
            <CardTitle>{t("onboarding.enterprise.cardTitle")}</CardTitle>
            <CardDescription>
              {t("onboarding.enterprise.cardDescription")}
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
