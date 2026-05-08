"use client";

// Enterprise onboarding — step 2: KYC.
//
// At this stage we only collect the registration / business number; the
// document upload itself lives in M3 (docs-coder) and gets done from the
// enterprise dashboard once the Enterprise row exists. We surface a clear
// note to that effect so users understand what's next.

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import type { EnterpriseFormValues } from "./enterprise-form-values";

export type EnterpriseStepKycProps = {
  form: UseFormReturn<EnterpriseFormValues>;
};

const FIELD_BASE = "block w-full text-sm font-medium text-foreground";

export function EnterpriseStepKyc({ form }: EnterpriseStepKycProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        We need basic legal identifiers to start verifying your company.
        You&apos;ll upload incorporation documents from your dashboard once your
        account is created.
      </p>

      <label className={FIELD_BASE}>
        Registration / business number
        <Input
          {...register("registrationNumber")}
          className="mt-1"
          placeholder="e.g. C12345678"
          aria-invalid={!!errors.registrationNumber}
        />
        {errors.registrationNumber && (
          <span className="mt-1 block text-xs text-destructive">
            {errors.registrationNumber.message}
          </span>
        )}
      </label>

      <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        Documents you&apos;ll upload after onboarding: incorporation
        certificate, tax registration, recent utility bill or bank statement.
      </div>
    </div>
  );
}
