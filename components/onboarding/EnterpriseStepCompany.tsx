"use client";

// Enterprise onboarding — step 1: company details.

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import type { EnterpriseFormValues } from "./enterprise-form-values";

export type EnterpriseStepCompanyProps = {
  form: UseFormReturn<EnterpriseFormValues>;
};

const FIELD_BASE = "block w-full text-sm font-medium text-foreground";

export function EnterpriseStepCompany({ form }: EnterpriseStepCompanyProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className={`${FIELD_BASE} md:col-span-2`}>
        Company name
        <Input
          {...register("companyName")}
          className="mt-1"
          autoComplete="organization"
          aria-invalid={!!errors.companyName}
        />
        {errors.companyName && (
          <span className="mt-1 block text-xs text-destructive">
            {errors.companyName.message}
          </span>
        )}
      </label>

      <label className={FIELD_BASE}>
        Sector
        <Input
          {...register("sector")}
          className="mt-1"
          placeholder="e.g. Hospitality"
          aria-invalid={!!errors.sector}
        />
        {errors.sector && (
          <span className="mt-1 block text-xs text-destructive">
            {errors.sector.message}
          </span>
        )}
      </label>

      <label className={FIELD_BASE}>
        Plan
        <select
          {...register("plan")}
          className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="FREE">Free (up to 3 active offers)</option>
          <option value="STARTER">Starter</option>
          <option value="PRO">Pro</option>
        </select>
        {errors.plan && (
          <span className="mt-1 block text-xs text-destructive">
            {errors.plan.message}
          </span>
        )}
      </label>

      <label className={`${FIELD_BASE} md:col-span-2`}>
        Address
        <Input
          {...register("address")}
          className="mt-1"
          autoComplete="street-address"
          aria-invalid={!!errors.address}
        />
        {errors.address && (
          <span className="mt-1 block text-xs text-destructive">
            {errors.address.message}
          </span>
        )}
      </label>
    </div>
  );
}
