"use client";

// MG Work — Admin matching-config (M5).
//
// Weighted sliders for the six matching criteria. The sum constraint is shown
// as a live indicator (success when 100, warning otherwise). A right-side
// preview pane runs a synthetic candidate↔offer scenario through the same
// weighted aggregation that the backend uses, so admins can see the impact of
// their tuning in real time before saving.
//
// Persists via PUT /api/admin/matching-config (zod strict; all six keys are
// required).

import * as React from "react";
import {
  PageHeader,
  Button,
  Card,
  Badge,
  Hairline,
  Stack,
  ScoreGauge,
  Progress,
  gaugeTone,
} from "@/components/mg";

type WeightKey =
  | "skills"
  | "languages"
  | "sector"
  | "mobility"
  | "experience"
  | "documents";

type Weights = Record<WeightKey, number>;

const DEFAULT_WEIGHTS: Weights = {
  skills: 35,
  languages: 25,
  sector: 20,
  mobility: 15,
  experience: 5,
  documents: 0,
};

const LABELS: Record<WeightKey, string> = {
  skills: "Compétences",
  languages: "Langues",
  sector: "Secteur",
  mobility: "Mobilité géographique",
  experience: "Expérience",
  documents: "Documents",
};

// Synthetic preview scenario — held constant so the score moves with weights.
const PREVIEW_SCORES: Record<WeightKey, number> = {
  skills: 92,
  languages: 88,
  sector: 95,
  mobility: 72,
  experience: 80,
  documents: 70,
};

const KEYS: WeightKey[] = [
  "skills",
  "languages",
  "sector",
  "mobility",
  "experience",
  "documents",
];

function SliderTrack({ value }: { value: number }) {
  return (
    <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 4,
          borderRadius: 9999,
          background: "hsl(var(--surface-3))",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          width: `${value}%`,
          height: 4,
          borderRadius: 9999,
          background: "hsl(var(--primary))",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${value}%`,
          transform: "translateX(-50%)",
          width: 16,
          height: 16,
          borderRadius: 9999,
          background: "hsl(var(--background))",
          border: "2px solid hsl(var(--primary))",
          boxShadow: "var(--shadow-sm)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default function MatchingConfigPage() {
  const [weights, setWeights] = React.useState<Weights>(DEFAULT_WEIGHTS);
  const [initial, setInitial] = React.useState<Weights>(DEFAULT_WEIGHTS);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<
    { tone: "ok" | "error"; text: string } | null
  >(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/matching-config", { method: "GET" });
        const json = (await res.json().catch(() => ({}))) as
          | { ok: true; data: { weights: Weights } }
          | { ok: false; error: { message: string } };
        if (!cancelled && res.ok && "ok" in json && json.ok) {
          setWeights(json.data.weights);
          setInitial(json.data.weights);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = KEYS.reduce((s, k) => s + weights[k], 0);
  const isValid = total === 100;

  const preview = Math.round(
    KEYS.reduce((s, k) => s + (PREVIEW_SCORES[k] * weights[k]) / 100, 0),
  );
  const tone = gaugeTone(preview);

  function update(k: WeightKey, raw: number) {
    const v = Math.max(0, Math.min(100, Math.round(Number.isFinite(raw) ? raw : 0)));
    setWeights((w) => ({ ...w, [k]: v }));
  }

  function reset() {
    setWeights({ ...initial });
    setMessage(null);
  }

  function restoreDefaults() {
    setWeights({ ...DEFAULT_WEIGHTS });
    setMessage(null);
  }

  async function onSave() {
    setMessage(null);
    if (total <= 0) {
      setMessage({ tone: "error", text: "Au moins une pondération doit être > 0." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/matching-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weights }),
      });
      const json = (await res.json().catch(() => ({}))) as
        | { ok: true; data: { weights: Weights } }
        | { ok: false; error: { message: string } };
      if (!res.ok || !("ok" in json) || !json.ok) {
        const msg =
          json && "error" in json && json.error?.message
            ? json.error.message
            : "Impossible d'enregistrer les pondérations";
        setMessage({ tone: "error", text: msg });
        return;
      }
      setInitial(json.data.weights);
      setMessage({ tone: "ok", text: "Pondérations enregistrées." });
    } catch (e) {
      setMessage({
        tone: "error",
        text: e instanceof Error ? e.message : "Erreur réseau",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Moteur de matching"
        subtitle="Pondérations globales appliquées au calcul des scores"
        action={
          <Stack dir="row" gap={8}>
            <Button
              variant="outline"
              size="default"
              onClick={restoreDefaults}
              disabled={saving || loading}
            >
              Restaurer défauts
            </Button>
            <Button
              size="default"
              iconLeft="check-circle-2"
              onClick={onSave}
              disabled={saving || loading || !isValid}
            >
              {saving ? "Enregistrement…" : "Publier la version"}
            </Button>
          </Stack>
        }
      />

      <div
        style={{
          padding: "0 32px 32px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Sliders */}
        <Card padding={28}>
          <Stack
            dir="row"
            justify="space-between"
            align="center"
            style={{ marginBottom: 4 }}
          >
            <h3 className="mg-h4" style={{ margin: 0 }}>
              Pondérations
            </h3>
            <Badge tone="info">Brouillon · auto-enregistré localement</Badge>
          </Stack>
          <p
            className="mg-body-sm"
            style={{ color: "hsl(var(--muted-foreground))", margin: "4px 0 24px" }}
          >
            La somme doit faire 100. La prévisualisation se met à jour en direct.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {KEYS.map((k) => (
              <div key={k}>
                <Stack
                  dir="row"
                  justify="space-between"
                  align="center"
                  style={{ marginBottom: 8 }}
                >
                  <label
                    htmlFor={`w-${k}`}
                    className="mg-body-sm"
                    style={{ fontWeight: 500 }}
                  >
                    {LABELS[k]}
                  </label>
                  <span
                    className="mg-tabular"
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      background: "hsl(var(--surface-2))",
                      border: "1px solid hsl(var(--border))",
                      padding: "2px 8px",
                      borderRadius: 4,
                      minWidth: 44,
                      textAlign: "center",
                    }}
                  >
                    {weights[k]}%
                  </span>
                </Stack>
                <div style={{ position: "relative" }}>
                  <SliderTrack value={weights[k]} />
                  <input
                    id={`w-${k}`}
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={weights[k]}
                    onChange={(e) => update(k, Number(e.target.value))}
                    aria-label={`${LABELS[k]} (pondération)`}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      opacity: 0,
                      cursor: "pointer",
                      margin: 0,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <Hairline style={{ margin: "24px 0 16px" }} />
          <Stack dir="row" justify="space-between" align="center">
            <span
              className="mg-caption"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              Total
            </span>
            {isValid ? (
              <Badge tone="success" icon="check-circle-2">
                100% · valide
              </Badge>
            ) : (
              <Badge tone="warning" icon="alert-triangle">
                {total}% · doit faire 100
              </Badge>
            )}
          </Stack>

          {message ? (
            <p
              className="mg-body-sm"
              style={{
                marginTop: 12,
                marginBottom: 0,
                color:
                  message.tone === "ok"
                    ? "hsl(var(--success))"
                    : "hsl(var(--destructive))",
              }}
            >
              {message.text}
            </p>
          ) : null}

          <Stack dir="row" gap={8} style={{ marginTop: 16 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={saving || loading}
            >
              Annuler les modifications
            </Button>
          </Stack>
        </Card>

        {/* Live preview */}
        <Card padding={24} surface={2}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <h3 className="mg-h4" style={{ margin: 0 }}>
              Prévisualisation
            </h3>
            <Badge tone="neutral">Échantillon · Tahiry R. ↔ Hôtel Lux</Badge>
          </div>
          <Card
            padding={24}
            elevation={1}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 8,
            }}
          >
            <ScoreGauge value={preview} size={120} stroke={8} />
            <div className="mg-h3" style={{ margin: "8px 0 0" }}>
              {tone.label}
            </div>
            <div
              className="mg-caption"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              recalculé en direct
            </div>
          </Card>
          <div
            style={{
              marginTop: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {KEYS.map((k) => {
              const score = PREVIEW_SCORES[k];
              const w = weights[k];
              const t: "success" | "primary" | "warning" =
                score >= 80 ? "success" : score >= 60 ? "primary" : "warning";
              return (
                <div key={k}>
                  <Stack
                    dir="row"
                    justify="space-between"
                    align="center"
                    style={{ marginBottom: 4 }}
                  >
                    <span className="mg-body-sm">{LABELS[k]}</span>
                    <span
                      className="mg-tabular mg-caption"
                      style={{ color: "hsl(var(--muted-foreground))" }}
                    >
                      {score} ×{" "}
                      <span
                        style={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                      >
                        {w}%
                      </span>
                    </span>
                  </Stack>
                  <Progress value={score} tone={t} height={4} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
