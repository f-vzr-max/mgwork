"use client";

// Candidate onboarding — step 1: identity.
//
// Collects firstName, lastName, dateOfBirth, nationality, phone, city.
// Validation is delegated to the parent's react-hook-form instance which is
// wired to lib/validation/candidate.ts (candidateCreateSchema).

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import type { CandidateFormValues } from "./candidate-form-values";

export type CandidateStepIdentityProps = {
  form: UseFormReturn<CandidateFormValues>;
};

const FIELD_BASE = "block w-full text-sm font-medium text-foreground";

export function CandidateStepIdentity({ form }: CandidateStepIdentityProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className={FIELD_BASE}>
        First name
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
        Last name
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
        Date of birth
        <Input
          type="date"
          {...register("dateOfBirth")}
          className="mt-1"
          aria-invalid={!!errors.dateOfBirth}
        />
        {errors.dateOfBirth && (
          <span className="mt-1 block text-xs text-destructive">
            {errors.dateOfBirth.message}
          </span>
        )}
      </label>

      <label className={FIELD_BASE}>
        Nationality (ISO-2)
        <Input
          {...register("nationality")}
          maxLength={2}
          placeholder="MG"
          className="mt-1 uppercase"
          aria-invalid={!!errors.nationality}
        />
        {errors.nationality && (
          <span className="mt-1 block text-xs text-destructive">
            {errors.nationality.message}
          </span>
        )}
      </label>

      <label className={FIELD_BASE}>
        Phone
        <Input
          type="tel"
          {...register("phone")}
          autoComplete="tel"
          placeholder="+261 ..."
          className="mt-1"
          aria-invalid={!!errors.phone}
        />
        {errors.phone && (
          <span className="mt-1 block text-xs text-destructive">
            {errors.phone.message}
          </span>
        )}
      </label>

      <label className={FIELD_BASE}>
        City
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
        Bio (optional)
        <textarea
          {...register("bio")}
          rows={3}
          maxLength={2000}
          className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="A short pitch about yourself."
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
