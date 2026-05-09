"use client";

// Candidate onboarding — step 3: skills (multi-tag input).
//
// Free-form skills typed by the user. Each skill is trimmed and de-duplicated
// (case-insensitive). Hard cap of 50 to mirror lib/validation/candidate.ts.

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { CandidateFormValues } from "./candidate-form-values";

const MAX_SKILLS = 50;

export type CandidateStepSkillsProps = {
  form: UseFormReturn<CandidateFormValues>;
};

export function CandidateStepSkills({ form }: CandidateStepSkillsProps) {
  const t = useTranslations();
  const skills = form.watch("skills") ?? [];
  const [input, setInput] = React.useState("");
  const error = form.formState.errors.skills?.message;

  function add() {
    const v = input.trim();
    if (!v) return;
    const lower = v.toLowerCase();
    if (skills.map((s) => s.toLowerCase()).includes(lower)) {
      setInput("");
      return;
    }
    if (skills.length >= MAX_SKILLS) return;
    form.setValue("skills", [...skills, v], { shouldDirty: true });
    setInput("");
  }

  function remove(i: number) {
    form.setValue(
      "skills",
      skills.filter((_, idx) => idx !== i),
      { shouldDirty: true },
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("onboarding.skills.intro")}
      </p>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={t("onboarding.skills.placeholder")}
          aria-label={t("onboarding.skills.addAria")}
        />
        <Button type="button" onClick={add} variant="secondary">
          {t("onboarding.skills.add")}
        </Button>
      </div>

      {skills.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("onboarding.skills.empty")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {skills.map((s, i) => (
            <li
              key={`${s}-${i}`}
              className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-xs"
            >
              <span>{s}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`${t("onboarding.skills.removeAria")} ${s}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        {`${skills.length} / ${MAX_SKILLS} ${t("onboarding.skills.count")}`}
      </p>
      {error && <p className="text-xs text-destructive">{String(error)}</p>}
    </div>
  );
}
