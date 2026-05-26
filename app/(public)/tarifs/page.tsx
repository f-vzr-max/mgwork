"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Badge,
  Button,
  Card,
  Hairline,
  Icon,
  PublicShell,
  Section,
  SectionHeader,
  Stack,
  type ButtonVariant,
} from "@/components/mg";
import { CtaBanner, FaqItem } from "../_components";

type Cycle = "monthly" | "annual";

const TIER_KEYS = ["t1", "t2", "t3"] as const;
type TierKey = (typeof TIER_KEYS)[number];

const TIER_META: Record<
  TierKey,
  { ctaVariant: ButtonVariant; featured: boolean; href: string }
> = {
  t1: { ctaVariant: "outline", featured: false, href: "/sign-up" },
  t2: { ctaVariant: "default", featured: true, href: "/contact" },
  t3: { ctaVariant: "outline", featured: false, href: "/contact" },
};

const TIER_FEATURE_FLAGS: Record<TierKey, boolean[]> = {
  t1: [true, true, true, true, false, false],
  t2: [true, true, true, true, true, false],
  t3: [true, true, true, true, true, true],
};

type FeatureValue = string | boolean;

type FeatureRowKey =
  | "r1"
  | "r2"
  | "r3"
  | "r4"
  | "r5"
  | "r6"
  | "r7"
  | "r8"
  | "r9"
  | "r10"
  | "r11"
  | "r12"
  | "r13";

const FEATURE_ROW_DEFS: { key: FeatureRowKey; s: FeatureValue; b: FeatureValue; e: FeatureValue }[] = [
  { key: "r1", s: "1", b: "6", e: "__unlimited__" },
  { key: "r2", s: "3", b: "15", e: "__unlimited__" },
  { key: "r3", s: true, b: true, e: true },
  { key: "r4", s: true, b: true, e: true },
  { key: "r5", s: true, b: true, e: true },
  { key: "r6", s: "__r6.s__", b: "__r6.b__", e: "__r6.e__" },
  { key: "r7", s: false, b: true, e: true },
  { key: "r8", s: "__r8.s__", b: "__r8.b__", e: "__r8.e__" },
  { key: "r9", s: false, b: false, e: true },
  { key: "r10", s: false, b: false, e: true },
  { key: "r11", s: false, b: false, e: true },
  { key: "r12", s: false, b: false, e: true },
  { key: "r13", s: "__r13.s__", b: "__r13.b__", e: "__r13.e__" },
];

export default function TarifsPage() {
  const t = useTranslations("marketing");
  const [cycle, setCycle] = React.useState<Cycle>("monthly");

  // Resolve string token to translated value, leaving plain strings alone.
  const resolveValue = (v: FeatureValue): FeatureValue => {
    if (typeof v !== "string") return v;
    if (v === "__unlimited__") return t("tarifs.matrix.unlimited");
    const tokenMatch = /^__(.+)__$/.exec(v);
    if (tokenMatch) return t(`tarifs.matrix.${tokenMatch[1]}`);
    return v;
  };

  return (
    <PublicShell active="tarifs">
      {/* Hero */}
      <div
        className="px-4 md:px-8 py-12 md:py-10"
        style={{
          background:
            "linear-gradient(180deg, rgba(26,60,110,0.06) 0%, hsl(var(--background)) 100%)",
        }}
      >
        <div style={{ maxWidth: 920, margin: "0 auto", textAlign: "center" }}>
          <Badge tone="primary" size="md" style={{ marginBottom: 20 }}>
            {t("tarifs.hero.badge")}
          </Badge>
          <h1 className="mg-display" style={{ margin: 0 }}>
            {t("tarifs.hero.titlePart1")}
            <span style={{ color: "hsl(var(--primary))" }}>
              {t("tarifs.hero.titleHighlight")}
            </span>
            {t("tarifs.hero.titlePart2")}
          </h1>
          <p
            className="mg-body-lg"
            style={{
              margin: "20px auto 0",
              color: "hsl(var(--muted-foreground))",
              maxWidth: 600,
            }}
          >
            {t("tarifs.hero.subtitle")}
          </p>
          {/* Toggle */}
          <div
            style={{
              display: "inline-flex",
              marginTop: 32,
              padding: 4,
              borderRadius: 9999,
              background: "hsl(var(--surface-2))",
              border: "1px solid hsl(var(--border))",
              fontSize: 13,
              fontWeight: 600,
            }}
            role="tablist"
            aria-label={t("tarifs.cycle.aria")}
          >
            {(
              [
                { labelKey: "tarifs.cycle.monthly", value: "monthly" as const },
                { labelKey: "tarifs.cycle.annual", value: "annual" as const },
              ]
            ).map((o) => {
              const active = o.value === cycle;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCycle(o.value)}
                  className={
                    active
                      ? undefined
                      : "hover:text-[hsl(var(--foreground))] transition-colors"
                  }
                  style={{
                    padding: "8px 18px",
                    borderRadius: 9999,
                    border: 0,
                    background: active ? "hsl(var(--background))" : "transparent",
                    color: active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                    boxShadow: active ? "var(--shadow-sm)" : "none",
                    cursor: "pointer",
                    font: "inherit",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {t(o.labelKey)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tiers */}
      <Section padY={64}>
        <div
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 items-stretch"
        >
          {TIER_KEYS.map((tierKey) => {
            const meta = TIER_META[tierKey];
            const price =
              cycle === "annual"
                ? t(`tarifs.${tierKey}.annualPrice`)
                : t(`tarifs.${tierKey}.monthlyPrice`);
            const flags = TIER_FEATURE_FLAGS[tierKey];
            return (
              <Card
                key={tierKey}
                padding={32}
                style={{
                  position: "relative",
                  border: meta.featured
                    ? "2px solid hsl(var(--primary))"
                    : "1px solid hsl(var(--border))",
                  boxShadow: meta.featured ? "var(--shadow-md)" : "var(--shadow-sm)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {meta.featured && (
                  <div
                    style={{
                      position: "absolute",
                      top: -12,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "hsl(var(--primary))",
                      color: "hsl(var(--primary-foreground))",
                      padding: "4px 12px",
                      borderRadius: 9999,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {t(`tarifs.${tierKey}.ribbon`)}
                  </div>
                )}
                <div>
                  <div className="mg-h3" style={{ margin: 0 }}>
                    {t(`tarifs.${tierKey}.name`)}
                  </div>
                  <div
                    className="mg-caption"
                    style={{ color: "hsl(var(--muted-foreground))", marginTop: 4 }}
                  >
                    {t(`tarifs.${tierKey}.tagline`)}
                  </div>
                </div>
                <Stack dir="row" gap={6} align="baseline">
                  <span
                    className="mg-tabular"
                    style={{
                      fontSize: 40,
                      fontWeight: 700,
                      letterSpacing: "-0.02em",
                      lineHeight: 1,
                    }}
                  >
                    {price}
                  </span>
                  <span
                    className="mg-caption"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    {t(`tarifs.${tierKey}.priceSub`)}
                  </span>
                </Stack>
                <Link href={meta.href} className="no-underline">
                  <Button variant={meta.ctaVariant} fullWidth iconRight="arrow-right">
                    {t(`tarifs.${tierKey}.cta`)}
                  </Button>
                </Link>
                <Hairline />
                <Stack gap={10}>
                  {flags.map((ok, i) => {
                    const featureKey = `f${i + 1}` as const;
                    return (
                      <Stack key={featureKey} dir="row" gap={10} align="center">
                        <Icon
                          name={ok ? "check-circle-2" : "x"}
                          size={16}
                          style={{
                            color: ok
                              ? "hsl(var(--success))"
                              : "hsl(var(--muted-foreground))",
                            flexShrink: 0,
                          }}
                        />
                        <span
                          className="mg-body-sm"
                          style={{
                            color: ok
                              ? "hsl(var(--foreground))"
                              : "hsl(var(--muted-foreground))",
                          }}
                        >
                          {t(`tarifs.${tierKey}.${featureKey}`)}
                        </span>
                      </Stack>
                    );
                  })}
                </Stack>
                <div
                  className="mg-caption"
                  style={{
                    color: "hsl(var(--muted-foreground))",
                    marginTop: "auto",
                    paddingTop: 8,
                  }}
                >
                  {t(`tarifs.${tierKey}.feeNote`)}
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* Feature matrix */}
      <Section padY={96} surface={2}>
        <SectionHeader
          eyebrow={t("tarifs.matrix.eyebrow")}
          title={t("tarifs.matrix.title")}
        />
        <Card padding={0} style={{ overflowX: "auto" }}>
          <div
            className="mg-micro"
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr 1fr 1fr",
              padding: "14px 24px",
              background: "hsl(var(--surface-2))",
              borderBottom: "1px solid hsl(var(--border))",
              color: "hsl(var(--muted-foreground))",
              minWidth: 640,
            }}
          >
            <span>{t("tarifs.matrix.colFeature")}</span>
            <span style={{ textAlign: "center" }}>{t("tarifs.matrix.colStarter")}</span>
            <span style={{ textAlign: "center", color: "hsl(var(--primary))" }}>
              {t("tarifs.matrix.colBusiness")}
            </span>
            <span style={{ textAlign: "center" }}>
              {t("tarifs.matrix.colEnterprise")}
            </span>
          </div>
          {FEATURE_ROW_DEFS.map((row, i) => (
            <div
              key={row.key}
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 1fr 1fr 1fr",
                padding: "14px 24px",
                alignItems: "center",
                borderTop: i === 0 ? 0 : "1px solid hsl(var(--border))",
                background: i % 2 === 1 ? "hsl(var(--surface-2))" : undefined,
                minWidth: 640,
              }}
            >
              <span className="mg-body-sm">{t(`tarifs.matrix.${row.key}.f`)}</span>
              {(["s", "b", "e"] as const).map((k) => {
                const v = resolveValue(row[k]);
                const isBusiness = k === "b";
                return (
                  <span
                    key={k}
                    style={{
                      textAlign: "center",
                      color: isBusiness
                        ? "hsl(var(--primary))"
                        : "hsl(var(--foreground))",
                      fontWeight: isBusiness ? 600 : 500,
                      fontSize: 14,
                    }}
                  >
                    {v === true && (
                      <Icon
                        name="check-circle-2"
                        size={18}
                        style={{
                          color: "hsl(var(--success))",
                          display: "inline-block",
                          verticalAlign: "middle",
                        }}
                      />
                    )}
                    {v === false && (
                      <Icon
                        name="x"
                        size={18}
                        style={{
                          color: "hsl(var(--muted-foreground))",
                          display: "inline-block",
                          verticalAlign: "middle",
                        }}
                      />
                    )}
                    {typeof v === "string" && v}
                  </span>
                );
              })}
            </div>
          ))}
        </Card>
      </Section>

      {/* FAQ */}
      <Section padY={96}>
        <SectionHeader
          eyebrow={t("tarifs.faq.eyebrow")}
          title={t("tarifs.faq.title")}
          align="center"
        />
        <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gap: 12 }}>
          <FaqItem
            open
            q={t("tarifs.faq.q1.q")}
            a={t("tarifs.faq.q1.a")}
          />
          <FaqItem q={t("tarifs.faq.q2.q")} a={t("tarifs.faq.q2.a")} />
          <FaqItem q={t("tarifs.faq.q3.q")} a={t("tarifs.faq.q3.a")} />
          <FaqItem q={t("tarifs.faq.q4.q")} a={t("tarifs.faq.q4.a")} />
          <FaqItem q={t("tarifs.faq.q5.q")} a={t("tarifs.faq.q5.a")} />
        </div>
      </Section>

      {/* CTA */}
      <Section padY={80}>
        <CtaBanner
          title={t("tarifs.cta.title")}
          body={t("tarifs.cta.body")}
          primary={t("tarifs.cta.primary")}
          primaryHref="/sign-up?role=employer"
        />
      </Section>
    </PublicShell>
  );
}
