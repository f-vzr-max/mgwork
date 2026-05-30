import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Badge,
  Button,
  Card,
  Hairline,
  Icon,
  PublicShell,
  ScoreGauge,
  Section,
  SectionHeader,
  Stack,
} from "@/components/mg";
import { CtaBanner, StepCard } from "../_components";

export async function generateMetadata() {
  const t = await getTranslations("marketing");
  return {
    title: t("entreprises.metaTitle"),
    description: t("entreprises.metaDescription"),
  };
}

const WHY_KEYS = ["w1", "w2", "w3"] as const;
const WHY_ICONS = ["shield-check", "sparkles", "users"] as const;

const PROCESS_KEYS = ["step1", "step2", "step3", "step4"] as const;
const PROCESS_ICONS = ["shield-check", "briefcase", "sparkles", "arrow-up-right"] as const;

const CASE_KEYS = ["c1", "c2"] as const;

const PRICING_KEYS = ["t1", "t2", "t3"] as const;
const PRICING_FEATURED: Record<(typeof PRICING_KEYS)[number], boolean> = {
  t1: false,
  t2: true,
  t3: false,
};

const HERO_MATCH_KEYS = ["candidate1", "candidate2", "candidate3"] as const;
const HERO_MATCH_SCORES: Record<(typeof HERO_MATCH_KEYS)[number], number> = {
  candidate1: 91,
  candidate2: 84,
  candidate3: 79,
};

export default async function EntreprisesPage() {
  const t = await getTranslations("marketing");

  return (
    <PublicShell active="entreprises">
      {/* Hero */}
      <div
        className="px-4 md:px-8 py-12 md:py-16"
        style={{
          background:
            "linear-gradient(180deg, rgba(26,60,110,0.06) 0%, hsl(var(--background)) 100%)",
        }}
      >
        <div
          className="mx-auto grid w-full max-w-[1120px] grid-cols-1 items-center gap-10 md:grid-cols-[1.1fr_0.9fr] md:gap-14"
        >
          <div>
            <Badge tone="primary" size="md" icon="building-2" style={{ marginBottom: 20 }}>
              {t("entreprises.hero.badge")}
            </Badge>
            <h1 className="mg-display" style={{ margin: 0, maxWidth: 540 }}>
              {t("entreprises.hero.titlePart1")}
              <br />
              <span style={{ color: "hsl(var(--primary))" }}>
                {t("entreprises.hero.titleHighlight")}
              </span>
              {t("entreprises.hero.titleSuffix")}
            </h1>
            <p
              className="mg-body-lg"
              style={{
                margin: "20px 0 0",
                color: "hsl(var(--muted-foreground))",
                maxWidth: 480,
              }}
            >
              {t("entreprises.hero.subtitle")}
            </p>
            <Stack dir="row" gap={12} style={{ marginTop: 32 }} wrap>
              <Link href="/contact" className="no-underline">
                <Button size="lg" iconRight="arrow-right">
                  {t("entreprises.hero.ctaDemo")}
                </Button>
              </Link>
              <Link href="/tarifs" className="no-underline">
                <Button size="lg" variant="outline">
                  {t("entreprises.hero.ctaPricing")}
                </Button>
              </Link>
            </Stack>
            <div
              className="flex flex-wrap items-center"
              style={{ marginTop: 32, gap: 24 }}
            >
              <Badge tone="success" icon="check-circle-2">
                {t("entreprises.hero.badgeKyc")}
              </Badge>
              <Badge tone="info" icon="shield-check">
                {t("entreprises.hero.badgeDpa")}
              </Badge>
              <Badge tone="neutral" icon="globe">
                {t("entreprises.hero.badgeCountries")}
              </Badge>
            </div>
          </div>
          <Card padding={0} elevation={2} style={{ overflow: "hidden" }}>
            <div
              style={{
                background: "hsl(var(--surface-2))",
                padding: "12px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid hsl(var(--border))",
              }}
            >
              <Stack dir="row" gap={6} align="center">
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 9999,
                    background: "hsl(var(--destructive))",
                    opacity: 0.6,
                  }}
                />
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 9999,
                    background: "hsl(var(--warning))",
                    opacity: 0.6,
                  }}
                />
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 9999,
                    background: "hsl(var(--success))",
                    opacity: 0.6,
                  }}
                />
              </Stack>
              <span
                className="mg-mono"
                style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}
              >
                mg-work.com/dashboard
              </span>
              <div style={{ width: 60 }} />
            </div>
            <div style={{ padding: 24 }}>
              <Stack
                dir="row"
                justify="space-between"
                align="center"
                style={{ marginBottom: 16 }}
              >
                <h3 className="mg-h4" style={{ margin: 0 }}>
                  {t("entreprises.hero.preview.matches")}
                </h3>
                <Badge tone="primary">{t("entreprises.hero.preview.piiMasked")}</Badge>
              </Stack>
              <div style={{ display: "grid", gap: 10 }}>
                {HERO_MATCH_KEYS.map((key) => (
                  <div
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  >
                    <ScoreGauge
                      value={HERO_MATCH_SCORES[key]}
                      size={40}
                      stroke={3}
                      label={false}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mg-body-sm" style={{ fontWeight: 600 }}>
                        {t(`entreprises.hero.preview.${key}.name`)} ·{" "}
                        {t(`entreprises.hero.preview.${key}.city`)}
                      </div>
                      <div
                        className="mg-caption"
                        style={{ color: "hsl(var(--muted-foreground))" }}
                      >
                        {t(`entreprises.hero.preview.${key}.sector`)}
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      {t("entreprises.hero.preview.shortlist")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Why */}
      <Section padY={96}>
        <SectionHeader
          eyebrow={t("entreprises.why.eyebrow")}
          title={t("entreprises.why.title")}
          align="center"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {WHY_KEYS.map((key, i) => (
            <Card key={key} padding={28}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  background: "var(--primary-bg)",
                  color: "hsl(var(--primary))",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <Icon name={WHY_ICONS[i]} size={24} />
              </div>
              <h3 className="mg-h3" style={{ margin: 0 }}>
                {t(`entreprises.why.${key}.title`)}
              </h3>
              <p
                className="mg-body"
                style={{
                  color: "hsl(var(--muted-foreground))",
                  marginTop: 8,
                  marginBottom: 0,
                }}
              >
                {t(`entreprises.why.${key}.body`)}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Process */}
      <Section padY={96} surface={2}>
        <SectionHeader
          eyebrow={t("entreprises.process.eyebrow")}
          title={t("entreprises.process.title")}
          align="center"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {PROCESS_KEYS.map((key, i) => (
            <StepCard
              key={key}
              n={i + 1}
              title={t(`entreprises.process.${key}.title`)}
              body={t(`entreprises.process.${key}.body`)}
              icon={PROCESS_ICONS[i]}
            />
          ))}
        </div>
      </Section>

      {/* Case studies */}
      <Section padY={96}>
        <SectionHeader
          eyebrow={t("entreprises.cases.eyebrow")}
          title={t("entreprises.cases.title")}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {CASE_KEYS.map((key) => (
            <Card key={key} padding={28}>
              <Stack
                dir="row"
                justify="space-between"
                align="flex-start"
                style={{ marginBottom: 16 }}
              >
                <div>
                  <div className="mg-h3" style={{ margin: 0 }}>
                    {t(`entreprises.cases.${key}.company`)}
                  </div>
                  <Badge tone="neutral" style={{ marginTop: 6 }}>
                    {t(`entreprises.cases.${key}.sector`)}
                  </Badge>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    className="mg-tabular"
                    style={{
                      fontSize: 28,
                      fontWeight: 700,
                      color: "hsl(var(--primary))",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {t(`entreprises.cases.${key}.metric`)}
                  </div>
                  <div
                    className="mg-caption"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    {t(`entreprises.cases.${key}.metricLabel`)}
                  </div>
                </div>
              </Stack>
              <p className="mg-body" style={{ color: "hsl(var(--foreground))" }}>
                &ldquo;{t(`entreprises.cases.${key}.quote`)}&rdquo;
              </p>
              <Hairline style={{ margin: "16px 0" }} />
              <Stack dir="row" justify="space-between" align="center">
                <span
                  className="mg-caption"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {t(`entreprises.cases.${key}.placements`)}{" "}
                  {t("entreprises.cases.placementsSuffix")}
                </span>
                <Button variant="link" iconRight="arrow-right">
                  {t("entreprises.cases.readMore")}
                </Button>
              </Stack>
            </Card>
          ))}
        </div>
      </Section>

      {/* Pricing tease */}
      <Section padY={96} surface={2}>
        <SectionHeader
          eyebrow={t("entreprises.pricing.eyebrow")}
          title={t("entreprises.pricing.title")}
          subtitle={t("entreprises.pricing.subtitle")}
          align="center"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {PRICING_KEYS.map((key) => {
            const featured = PRICING_FEATURED[key];
            return (
              <Card
                key={key}
                padding={28}
                style={
                  featured
                    ? {
                        borderColor: "hsl(var(--primary))",
                        borderWidth: 2,
                        boxShadow: "var(--shadow-md)",
                      }
                    : undefined
                }
              >
                {featured && (
                  <Badge tone="primary" style={{ marginBottom: 12 }}>
                    {t("entreprises.pricing.popular")}
                  </Badge>
                )}
                <div className="mg-h3" style={{ margin: 0 }}>
                  {t(`entreprises.pricing.${key}.name`)}
                </div>
                <Stack dir="row" gap={6} align="baseline" style={{ marginTop: 12 }}>
                  <span
                    className="mg-tabular"
                    style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em" }}
                  >
                    {t(`entreprises.pricing.${key}.price`)}
                  </span>
                  <span
                    className="mg-caption"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    {t(`entreprises.pricing.${key}.sub`)}
                  </span>
                </Stack>
                <p
                  className="mg-body-sm"
                  style={{
                    color: "hsl(var(--muted-foreground))",
                    margin: "12px 0 24px",
                  }}
                >
                  {t(`entreprises.pricing.${key}.desc`)}
                </p>
                <Link href="/tarifs" className="no-underline">
                  <Button
                    fullWidth
                    variant={featured ? "default" : "outline"}
                    iconRight="arrow-right"
                  >
                    {t(`entreprises.pricing.${key}.cta`)}
                  </Button>
                </Link>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* CTA */}
      <Section padY={80}>
        <CtaBanner
          title={t("entreprises.cta.title")}
          body={t("entreprises.cta.body")}
          primary={t("entreprises.cta.primary")}
          primaryHref="/sign-up?role=employer"
          secondary={t("entreprises.cta.secondary")}
          secondaryHref="/contact"
        />
      </Section>
    </PublicShell>
  );
}
