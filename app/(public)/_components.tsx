import * as React from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Hairline,
  Icon,
  ScoreGauge,
  Stack,
  type IconName,
} from "@/components/mg";

// Shared building blocks for the public marketing pages.
// Ported from artboards-public.jsx — kept as plain server components so they
// can be reused across Home, Candidats, Entreprises, Conformité and Tarifs.

export interface StepCardProps {
  n: number;
  title: string;
  body: string;
  icon?: IconName;
}

export function StepCard({ n, title, body, icon }: StepCardProps) {
  return (
    <Card
      padding={24}
      style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}
    >
      <Stack dir="row" align="center" gap={12}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9999,
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {n}
        </div>
        {icon && (
          <Icon name={icon} size={18} style={{ color: "hsl(var(--muted-foreground))" }} />
        )}
      </Stack>
      <h3 className="mg-h4" style={{ margin: 0 }}>
        {title}
      </h3>
      <p
        className="mg-body-sm"
        style={{ color: "hsl(var(--muted-foreground))", margin: 0 }}
      >
        {body}
      </p>
    </Card>
  );
}

export interface SectorCardProps {
  icon: IconName;
  name: string;
  jobs: number;
  growth: string;
}

export function SectorCard({ icon, name, jobs, growth }: SectorCardProps) {
  return (
    <Card
      padding={20}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: "var(--primary-bg)",
          color: "hsl(var(--primary))",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={20} />
      </div>
      <div className="mg-h4" style={{ margin: 0 }}>
        {name}
      </div>
      <Stack dir="row" justify="space-between" align="center">
        <span className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
          {jobs} postes
        </span>
        <Badge tone="success" icon="arrow-up">
          {growth}
        </Badge>
      </Stack>
    </Card>
  );
}

export interface CountryCardProps {
  flagColors: [string, string];
  name: string;
  label: string;
  stats: { value: string; label: string }[];
}

export function CountryCard({ flagColors, name, label, stats }: CountryCardProps) {
  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <div
        style={{
          height: 140,
          background: `linear-gradient(135deg, ${flagColors[0]}, ${flagColors[1]})`,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 20,
            background: "rgba(255,255,255,0.95)",
            padding: "4px 10px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            color: "hsl(var(--foreground))",
          }}
        >
          {label}
        </div>
      </div>
      <div style={{ padding: 24 }}>
        <h3 className="mg-h3" style={{ margin: 0 }}>
          {name}
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
            marginTop: 16,
          }}
        >
          {stats.map((s) => (
            <div key={s.label}>
              <div
                className="mg-tabular"
                style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.015em" }}
              >
                {s.value}
              </div>
              <div
                className="mg-caption"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export interface TestimonialCardProps {
  quote: string;
  name: string;
  role: string;
  score?: number;
}

export function TestimonialCard({ quote, name, role, score }: TestimonialCardProps) {
  return (
    <Card
      padding={28}
      style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%" }}
    >
      <div
        style={{
          fontSize: 32,
          color: "hsl(var(--primary))",
          lineHeight: 1,
          fontWeight: 700,
        }}
        aria-hidden="true"
      >
        &ldquo;
      </div>
      <p className="mg-body" style={{ margin: 0, color: "hsl(var(--foreground))" }}>
        {quote}
      </p>
      <div style={{ marginTop: "auto" }}>
        <Hairline style={{ margin: "0 0 16px" }} />
        <Stack dir="row" gap={12} align="center">
          <Avatar name={name} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mg-body-sm" style={{ fontWeight: 600 }}>
              {name}
            </div>
            <div
              className="mg-caption"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              {role}
            </div>
          </div>
          {score !== undefined && (
            <ScoreGauge value={score} size={44} stroke={4} label={false} />
          )}
        </Stack>
      </div>
    </Card>
  );
}

export interface FaqItemProps {
  q: string;
  a?: string;
  open?: boolean;
}

export function FaqItem({ q, a, open = false }: FaqItemProps) {
  return (
    <Card
      padding={24}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <Stack dir="row" justify="space-between" align="center" gap={16}>
        <span className="mg-h4" style={{ margin: 0 }}>
          {q}
        </span>
        <Icon
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          style={{ color: "hsl(var(--muted-foreground))" }}
        />
      </Stack>
      {open && a && (
        <p
          className="mg-body-sm"
          style={{ margin: 0, color: "hsl(var(--muted-foreground))" }}
        >
          {a}
        </p>
      )}
    </Card>
  );
}

export interface CtaBannerProps {
  title: string;
  body?: string;
  primary: string;
  secondary?: string;
}

export function CtaBanner({ title, body, primary, secondary }: CtaBannerProps) {
  return (
    <div
      style={{
        background: "hsl(var(--primary))",
        color: "hsl(var(--primary-foreground))",
        borderRadius: 12,
        padding: "48px 56px",
        display: "grid",
        gridTemplateColumns: "1.5fr auto",
        gap: 32,
        alignItems: "center",
      }}
    >
      <div>
        <h2
          className="mg-h1"
          style={{ margin: 0, color: "inherit", textWrap: "balance" as React.CSSProperties["textWrap"] }}
        >
          {title}
        </h2>
        {body && (
          <p className="mg-body-lg" style={{ margin: "12px 0 0", opacity: 0.85 }}>
            {body}
          </p>
        )}
      </div>
      <Stack dir="row" gap={12}>
        {secondary && (
          <Button
            size="lg"
            variant="ghost"
            style={{
              color: "hsl(var(--primary-foreground))",
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          >
            {secondary}
          </Button>
        )}
        <Button
          size="lg"
          iconRight="arrow-right"
          style={{
            background: "hsl(var(--primary-foreground))",
            color: "hsl(var(--primary))",
          }}
        >
          {primary}
        </Button>
      </Stack>
    </div>
  );
}
