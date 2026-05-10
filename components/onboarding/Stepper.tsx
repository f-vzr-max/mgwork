"use client";

// Stepper — visual progress indicator for multi-step onboarding flows.
//
// Renders one row of dots + labels with the current step highlighted in
// brand blue and completed steps in brand green. Pure presentation — the
// parent owns step state.

import * as React from "react";
import { cn } from "@/lib/utils";

export type StepperStep = {
  key: string;
  label: string;
};

export type StepperProps = {
  steps: StepperStep[];
  currentIndex: number;
  className?: string;
};

export function Stepper({ steps, currentIndex, className }: StepperProps) {
  return (
    <ol
      className={cn(
        "flex w-full items-center justify-between gap-2 text-xs sm:text-sm",
        className,
      )}
      aria-label="Onboarding progress"
    >
      {steps.map((step, i) => {
        const status: "done" | "current" | "upcoming" =
          i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming";

        return (
          <li
            key={step.key}
            className="flex flex-1 items-center gap-2"
            aria-current={status === "current" ? "step" : undefined}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                status === "done" && "border-brand-green bg-brand-green text-white",
                status === "current" && "border-brand-blue bg-brand-blue text-white",
                status === "upcoming" && "border-muted-foreground/30 bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <span
              className={cn(
                "truncate",
                status === "current" ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "ml-2 hidden h-px flex-1 sm:block",
                  status === "done" ? "bg-brand-green" : "bg-muted-foreground/30",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
