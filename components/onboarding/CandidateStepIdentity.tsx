"use client";

// Candidate onboarding — step 1: identity.
//
// Collects firstName, lastName, dateOfBirth, phone, city, bio. Phone is
// captured without the country code; the server-side schema in
// lib/validation/candidate.ts normalises every input to +261XXXXXXXXX.

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import type { CandidateFormValues } from "./candidate-form-values";

export type CandidateStepIdentityProps = {
  form: UseFormReturn<CandidateFormValues>;
};

const FIELD_BASE = "block w-full text-sm font-medium text-foreground";

// --- DOB as three selects (W2-B) --------------------------------------------
//
// Native <input type="date"> is unreliable across locales/mobile and lets a
// user fat-finger an out-of-range year. We capture day/month/year as separate
// <select>s and compose a zero-padded ISO `yyyy-mm-dd` string into the hidden
// `dateOfBirth` RHF field. Validation (age >= 18, no future date) is enforced
// by the step schema AND again server-side in lib/validation/candidate.ts —
// the client is never the trust boundary.

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Decompose an ISO yyyy-mm-dd string into numeric parts (or empties).
function splitIso(iso: string | undefined): { y: string; m: string; d: string } {
  if (!iso) return { y: "", m: "", d: "" };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return { y: "", m: "", d: "" };
  return { y: match[1]!, m: match[2]!, d: match[3]! };
}

const SELECT_STYLE: React.CSSProperties = {
  height: 40,
  width: "100%",
  padding: "0 8px",
  background: "hsl(var(--background))",
  color: "hsl(var(--foreground))",
  border: "1px solid hsl(var(--input))",
  borderRadius: 8,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
};

function DobSelects({ form }: { form: UseFormReturn<CandidateFormValues> }) {
  const t = useTranslations();
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  // Register the hidden field so RHF tracks/validates it; the selects drive it.
  React.useEffect(() => {
    register("dateOfBirth");
  }, [register]);

  const current = watch("dateOfBirth");
  const { y, m, d } = splitIso(current);

  const thisYear = new Date().getFullYear();
  // Oldest reasonable applicant ~100y; youngest allowed is 18y ago.
  const years = React.useMemo(() => {
    const out: number[] = [];
    for (let yr = thisYear - 18; yr >= thisYear - 100; yr--) out.push(yr);
    return out;
  }, [thisYear]);
  const months = React.useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const days = React.useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), []);

  const update = (part: "y" | "m" | "d", value: string) => {
    const next = { y, m, d, [part]: value } as { y: string; m: string; d: string };
    // Only compose a full ISO when all three parts are present; otherwise clear
    // so a partial selection doesn't validate as a (wrong) date.
    const composed =
      next.y && next.m && next.d ? `${next.y}-${next.m}-${next.d}` : "";
    setValue("dateOfBirth", composed, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  return (
    <div className={FIELD_BASE}>
      {t("onboarding.fields.dob")}
      <div className="mt-1 grid grid-cols-3 gap-2">
        <select
          aria-label={t("onboarding.fields.dobDay")}
          value={d}
          onChange={(e) => update("d", e.target.value)}
          style={SELECT_STYLE}
          aria-invalid={!!errors.dateOfBirth}
        >
          <option value="">{t("onboarding.fields.dobDay")}</option>
          {days.map((n) => (
            <option key={n} value={pad2(n)}>
              {n}
            </option>
          ))}
        </select>
        <select
          aria-label={t("onboarding.fields.dobMonth")}
          value={m}
          onChange={(e) => update("m", e.target.value)}
          style={SELECT_STYLE}
          aria-invalid={!!errors.dateOfBirth}
        >
          <option value="">{t("onboarding.fields.dobMonth")}</option>
          {months.map((n) => (
            <option key={n} value={pad2(n)}>
              {n}
            </option>
          ))}
        </select>
        <select
          aria-label={t("onboarding.fields.dobYear")}
          value={y}
          onChange={(e) => update("y", e.target.value)}
          style={SELECT_STYLE}
          aria-invalid={!!errors.dateOfBirth}
        >
          <option value="">{t("onboarding.fields.dobYear")}</option>
          {years.map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <span className="mt-1 block text-xs text-muted-foreground">
        {t("onboarding.fields.dobHelper")}
      </span>
      {errors.dateOfBirth && (
        <span className="mt-1 block text-xs text-destructive">
          {errors.dateOfBirth.message}
        </span>
      )}
    </div>
  );
}

export function CandidateStepIdentity({ form }: CandidateStepIdentityProps) {
  const t = useTranslations();
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className={FIELD_BASE}>
        {t("onboarding.fields.firstName")}
        <Input
          {...register("firstName")}
          className="mt-1"
          autoComplete="given-name"
          aria-invalid={!!errors.firstName}
        />
        {errors.firstName && (
          <span className="mt-1 block text-xs text-destructive">
            {errors.firstName.message}
          </span>
        )}
      </label>

      <label className={FIELD_BASE}>
        {t("onboarding.fields.lastName")}
        <Input
          {...register("lastName")}
          className="mt-1"
          autoComplete="family-name"
          aria-invalid={!!errors.lastName}
        />
        {errors.lastName && (
          <span className="mt-1 block text-xs text-destructive">
            {errors.lastName.message}
          </span>
        )}
      </label>

      <DobSelects form={form} />

      <label className={FIELD_BASE}>
        {t("onboarding.fields.phone")}
        <div className="mt-1 flex items-stretch">
          <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
            +261
          </span>
          <Input
            type="tel"
            inputMode="tel"
            {...register("phone")}
            autoComplete="tel-national"
            placeholder={t("onboarding.fields.phonePlaceholder")}
            className="rounded-l-none"
            aria-invalid={!!errors.phone}
          />
        </div>
        <span className="mt-1 block text-xs text-muted-foreground">
          {t("onboarding.fields.phoneHelper")}
        </span>
        {errors.phone && (
          <span className="mt-1 block text-xs text-destructive">
            {errors.phone.message}
          </span>
        )}
      </label>

      <label className={FIELD_BASE}>
        {t("onboarding.fields.city")}
        <Input
          {...register("city")}
          autoComplete="address-level2"
          className="mt-1"
          aria-invalid={!!errors.city}
        />
        {errors.city && (
          <span className="mt-1 block text-xs text-destructive">
            {errors.city.message}
          </span>
        )}
      </label>

      <label className={`${FIELD_BASE} md:col-span-2`}>
        {t("onboarding.fields.bioOptional")}
        <textarea
          {...register("bio")}
          rows={3}
          maxLength={2000}
          className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder={t("onboarding.fields.bioPlaceholder")}
        />
        {errors.bio && (
          <span className="mt-1 block text-xs text-destructive">
            {errors.bio.message}
          </span>
        )}
      </label>
    </div>
  );
}
