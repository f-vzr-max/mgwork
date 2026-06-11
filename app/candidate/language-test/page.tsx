"use client";

// MG Work — AI-verified language test (M5).
//
// Candidate-facing flow for /api/ai/lang-test: pick FR or EN, answer a short
// fixed set of free-form prompts, submit the transcript for AI grading
// (CEFR-aligned 0–100), then see the score + one-line examiner feedback. A
// passing grade stamps Candidate.langScore*VerifiedAt server-side, which is
// what the dashboard card and the enterprise views surface as "verified".
//
// The PROMPTS below are intentionally NOT run through next-intl: the test is
// taken in the target language (a French test asks French questions whatever
// the UI locale), and the same q strings are sent to the grader as context.

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Badge,
  Button,
  Card,
  Icon,
  Progress,
  ScoreGauge,
  Stack,
  Textarea,
} from "@/components/mg";
import type { LangTestResult } from "@/types/api";

type Lang = "FR" | "EN";

const PROMPTS: Record<Lang, string[]> = {
  FR: [
    "Présentez-vous en quelques phrases : qui êtes-vous et d'où venez-vous ?",
    "Décrivez votre dernière expérience de travail. Qu'avez-vous appris ?",
    "Pourquoi voulez-vous travailler à Maurice ?",
    "Racontez une difficulté que vous avez rencontrée au travail et comment vous l'avez résolue.",
  ],
  EN: [
    "Introduce yourself in a few sentences: who are you and where are you from?",
    "Describe your most recent work experience. What did you learn?",
    "Why do you want to work in Mauritius?",
    "Tell us about a problem you faced at work and how you solved it.",
  ],
};

const MAX_ANSWER_LEN = 4000; // mirrors aiLangTestSchema's a.max(4000)

type ApiResponse =
  | { ok: true; data: LangTestResult }
  | { ok: false; error: { code?: string; message: string } };

export default function LanguageTestPage(): React.ReactElement {
  const t = useTranslations("langTest");

  const [lang, setLang] = React.useState<Lang | null>(null);
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState<string[]>([]);
  const [grading, setGrading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<LangTestResult | null>(null);

  const questions = lang ? PROMPTS[lang] : [];
  const total = questions.length;

  function start(picked: Lang) {
    setLang(picked);
    setStep(0);
    setAnswers(Array.from({ length: PROMPTS[picked].length }, () => ""));
    setError(null);
    setResult(null);
  }

  function onAnswer(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setAnswers((prev) => prev.map((a, i) => (i === step ? v : a)));
    setError(null);
  }

  async function submit(finalAnswers: string[]) {
    if (!lang) return;
    setGrading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/lang-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          lang,
          answers: questions.map((q, i) => ({ q, a: finalAnswers[i].trim() })),
        }),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse | null;
      if (res.ok && json && json.ok) {
        setResult(json.data);
        return;
      }
      if (res.status === 429) setError(t("errors.rateLimited"));
      else if (res.status === 503) setError(t("errors.unavailable"));
      else setError(t("errors.generic"));
    } catch {
      setError(t("errors.generic"));
    } finally {
      setGrading(false);
    }
  }

  function next() {
    if (!answers[step] || answers[step].trim().length === 0) {
      setError(t("errors.emptyAnswer"));
      return;
    }
    if (step + 1 < total) {
      setStep(step + 1);
      setError(null);
    } else {
      void submit(answers);
    }
  }

  const muted = { color: "hsl(var(--muted-foreground))" } as const;

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 className="mg-h1" style={{ margin: 0, fontSize: 26, lineHeight: "32px" }}>
          {t("title")}
        </h1>
        <div className="mg-caption" style={{ ...muted, marginTop: 4 }}>
          {t("subtitle")}
        </div>
      </div>

      {/* Result --------------------------------------------------------- */}
      {result && lang ? (
        <Card padding={20}>
          <Stack dir="row" gap={20} align="center">
            <ScoreGauge value={result.score} size={88} stroke={6} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Stack dir="row" gap={8} align="center" wrap>
                <div className="mg-h3" style={{ margin: 0 }}>
                  {t("result.title", { lang: t(lang === "FR" ? "choose.fr" : "choose.en") })}
                </div>
                <Badge tone="success" icon="check-circle-2">{t("badge.verified")}</Badge>
              </Stack>
              {result.feedback && (
                <div className="mg-body-sm" style={{ ...muted, marginTop: 6 }}>
                  {result.feedback}
                </div>
              )}
            </div>
          </Stack>
          <Stack dir="row" gap={10} wrap style={{ marginTop: 16 }}>
            <Button
              variant="outline"
              size="sm"
              iconLeft="globe"
              onClick={() => start(lang === "FR" ? "EN" : "FR")}
            >
              {t("result.testOther", {
                lang: t(lang === "FR" ? "choose.en" : "choose.fr"),
              })}
            </Button>
            <Link href="/candidate" style={{ textDecoration: "none" }}>
              <Button size="sm" iconRight="arrow-right">{t("result.backToDashboard")}</Button>
            </Link>
          </Stack>
        </Card>
      ) : lang === null ? (
        /* Language picker ----------------------------------------------- */
        <Card padding={20}>
          <div className="mg-h4" style={{ margin: 0 }}>{t("choose.title")}</div>
          <div className="mg-caption" style={{ ...muted, marginTop: 4 }}>
            {t("choose.hint", { n: PROMPTS.FR.length })}
          </div>
          <Stack dir="row" gap={10} style={{ marginTop: 16 }} wrap>
            <Button variant="outline" iconLeft="globe" onClick={() => start("FR")}>
              {t("choose.fr")}
            </Button>
            <Button variant="outline" iconLeft="globe" onClick={() => start("EN")}>
              {t("choose.en")}
            </Button>
          </Stack>
        </Card>
      ) : (
        /* Quiz ----------------------------------------------------------- */
        <Card padding={20}>
          <Stack dir="row" justify="space-between" align="center">
            <span className="mg-caption" style={muted}>
              {t("progress", { current: step + 1, total })}
            </span>
            <Badge tone="neutral">{t(lang === "FR" ? "choose.fr" : "choose.en")}</Badge>
          </Stack>
          <Progress value={step + 1} max={total} height={6} style={{ marginTop: 8 }} />
          <div className="mg-body-sm" style={{ fontWeight: 600, marginTop: 16 }}>
            {questions[step]}
          </div>
          <div style={{ marginTop: 10 }}>
            <Textarea
              value={answers[step] ?? ""}
              onChange={onAnswer}
              rows={5}
              maxLength={MAX_ANSWER_LEN}
              placeholder={t("answerPlaceholder")}
              disabled={grading}
            />
          </div>
          {error && (
            <div className="mg-caption" style={{ color: "hsl(var(--destructive))", marginTop: 10 }}>
              {error}
            </div>
          )}
          <Stack dir="row" justify="space-between" align="center" style={{ marginTop: 16 }}>
            <Button
              variant="ghost"
              size="sm"
              iconLeft="chevron-left"
              disabled={step === 0 || grading}
              onClick={() => {
                setStep(Math.max(0, step - 1));
                setError(null);
              }}
            >
              {t("previous")}
            </Button>
            <Button onClick={next} disabled={grading} iconRight={grading ? undefined : "arrow-right"}>
              {grading ? (
                <Stack dir="row" gap={6} align="center">
                  <Icon name="circle-dashed" size={14} />
                  {t("grading")}
                </Stack>
              ) : step + 1 < total ? (
                t("next")
              ) : (
                t("submit")
              )}
            </Button>
          </Stack>
        </Card>
      )}
    </div>
  );
}
