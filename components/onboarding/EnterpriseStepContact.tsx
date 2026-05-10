"use client";

// Enterprise onboarding — step 3: primary contact.

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import type { EnterpriseFormValues } from "./enterprise-form-values";

export type EnterpriseStepContactProps = {
  form: UseFormReturn<EnterpriseFormValues>;
};

const FIELD_BASE = "block w-full text-sm font-medium text-foreground";

export function EnterpriseStepContact({ form }: EnterpriseStepContactProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className={FIELD_BASE}>
        Contact name
        <Input
          {...register("contactName")}
          className="mt-1"
          autoComplete="name"
          aria-invalid={!!errors.contactName}
        />
        {errors.contactName && (
          <span className="mt-1 block text-xs text-destructive">
            {errors.contactName.message}
          </span>
        )}
      </label>

      <label className={FIELD_BASE}>
        Contact phone
        <Input
          type="tel"
          {...register("contactPhone")}
          className="mt-1"
          autoComplete="tel"
          placeholder="+230 ..."
          aria-invalid={!!errors.contactPhone}
        />
        {errors.contactPhone && (
          <span className="mt-1 block text-xs text-destructive">
            {errors.contactPhone.message}
          </span>
        )}
      </label>
    </div>
  );
}
