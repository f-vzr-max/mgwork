"use client";

// Candidate onboarding — step 2: self-assessed FR + EN scores.
//
// Each language has a 0-100 slider. An optional "Take a quick test" button
// triggers the AI lang-test endpoint (M5, owned by ai-coder). The endpoint may
// 404 in dev — when it does we silently keep the user's self-assessment.

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { CandidateFormValues } from "./candidate-form-values";

export type CandidateStepLanguagesProps = {
  form: UseFormReturn<CandidateFormValues>;
};

type Lang = "FR" | "EN";

async function tryLangTest(lang: Lang): Promise<number | null> {
  // Best-effort — endpoint may not be deployed yet (M5).
  try {
    const res = await fetch("/api/ai/lang-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang, answers: [] }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as
      | { ok: true; data: { score: number } }
      | { ok: false };
    if (!json.ok) return null;
    return json.data.score;
  } catch {
    return null;
  }
}

function ScoreSlider({
  lang,
  form,
  langLabels,
}: {
  lang: Lang;
  form: UseFormReturn<CandidateFormValues>;
  langLabels: Record<Lang, string>;
}) {
  const t = useTranslations();
  const [busy, setBusy] = React.useState(false);
  const fieldName = lang === "FR" ? "langScoreFR" : "langScoreEN";
  const value = form.watch(fieldName) ?? 50;

  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{langLabels[lang]}</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {value} / 100
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) =>
          form.setValue(fieldName, Number(e.target.value), {
            shouldDirty: true,
          })
        }
        className="w-full accent-brand-blue"
        aria-label={`${t("onboarding.languages.selfAssessAria")} ${langLabels[lang]}`}
      />
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const score = await tryLangTest(lang);
            setBusy(false);
            if (score === null) return;
            form.setValue(fieldName, score, { shouldDirty: true });
          }}
        >
          {busy ? t("onboarding.languages.testing") : t("onboarding.languages.takeTest")}
        </Button>
      </div>
    </div>
  );
}

export function CandidateStepLanguages({ form }: CandidateStepLanguagesProps) {
  const t = useTranslations();
  const LANG_LABELS: Record<Lang, string> = {
    FR: t("onboarding.languages.fr"),
    EN: t("onboarding.languages.en"),
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("onboarding.languages.intro")}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <ScoreSlider lang="FR" form={form} langLabels={LANG_LABELS} />
        <ScoreSlider lang="EN" form={form} langLabels={LANG_LABELS} />
      </div>
    </div>
  );
}
