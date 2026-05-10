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

// Compute the latest DOB allowed (today minus 18 years, ISO yyyy-mm-dd).
function maxDobIso(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

export function CandidateStepIdentity({ form }: CandidateStepIdentityProps) {
  const t = useTranslations();
  const {
    register,
    formState: { errors },
  } = form;

  const dobMax = React.useMemo(maxDobIso, []);

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

      <label className={FIELD_BASE}>
        {t("onboarding.fields.dob")}
        <Input
          type="date"
          max={dobMax}
          {...register("dateOfBirth")}
          className="mt-1"
          aria-invalid={!!errors.dateOfBirth}
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          {t("onboarding.fields.dobHelper")}
        </span>
        {errors.dateOfBirth && (
          <span className="mt-1 block text-xs text-destructive">
            {errors.dateOfBirth.message}
          </span>
        )}
      </label>

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
