"use client";

// Candidate onboarding — step 4: sectors of interest (multi-select).
//
// Pre-populated with the sectors the platform targets per the roadmap. Users
// can also add a custom sector with the "Other" input. Cap aligns with the
// schema (max 20).
//
// Canonical stored values are in English (e.g. "Hospitality") so downstream
// matching is locale-agnostic. Only the rendered label switches via t().

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CandidateFormValues } from "./candidate-form-values";

const MAX_SECTORS = 20;

const PRESET_SECTORS = [
  { key: "Hospitality", labelKey: "onboarding.sectors.preset.hospitality" },
  { key: "Construction", labelKey: "onboarding.sectors.preset.construction" },
  { key: "Domestic work", labelKey: "onboarding.sectors.preset.domesticWork" },
  { key: "Healthcare", labelKey: "onboarding.sectors.preset.healthcare" },
  { key: "Logistics", labelKey: "onboarding.sectors.preset.logistics" },
  { key: "Manufacturing", labelKey: "onboarding.sectors.preset.manufacturing" },
  { key: "Agriculture", labelKey: "onboarding.sectors.preset.agriculture" },
  { key: "Retail", labelKey: "onboarding.sectors.preset.retail" },
  { key: "BPO / Call center", labelKey: "onboarding.sectors.preset.bpo" },
  { key: "IT", labelKey: "onboarding.sectors.preset.it" },
] as const;

export type CandidateStepSectorsProps = {
  form: UseFormReturn<CandidateFormValues>;
};

export function CandidateStepSectors({ form }: CandidateStepSectorsProps) {
  const t = useTranslations();
  const sectors = form.watch("sectors") ?? [];
  const [other, setOther] = React.useState("");

  function toggle(s: string) {
    const set = new Set(sectors.map((x) => x.toLowerCase()));
    if (set.has(s.toLowerCase())) {
      form.setValue(
        "sectors",
        sectors.filter((x) => x.toLowerCase() !== s.toLowerCase()),
        { shouldDirty: true },
      );
      return;
    }
    if (sectors.length >= MAX_SECTORS) return;
    form.setValue("sectors", [...sectors, s], { shouldDirty: true });
  }

  function addOther() {
    const v = other.trim();
    if (!v) return;
    if (sectors.map((s) => s.toLowerCase()).includes(v.toLowerCase())) {
      setOther("");
      return;
    }
    if (sectors.length >= MAX_SECTORS) return;
    form.setValue("sectors", [...sectors, v], { shouldDirty: true });
    setOther("");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("onboarding.sectors.intro")}
      </p>

      <div className="flex flex-wrap gap-2">
        {PRESET_SECTORS.map((s) => {
          const active = sectors.some((x) => x.toLowerCase() === s.key.toLowerCase());
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                active
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-input bg-background hover:bg-accent",
              )}
            >
              {t(s.labelKey)}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Input
          value={other}
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOther();
            }
          }}
          placeholder={t("onboarding.sectors.otherPlaceholder")}
          aria-label={t("onboarding.sectors.addAria")}
        />
        <Button type="button" variant="secondary" onClick={addOther}>
          {t("onboarding.sectors.add")}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {`${sectors.length} / ${MAX_SECTORS} ${t("onboarding.sectors.selected")}`}
      </p>
    </div>
  );
}
