import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Badge,
  Button,
  Card,
  Hairline,
  Icon,
  Progress,
  PublicShell,
  ScoreGauge,
  Section,
  SectionHeader,
  Stack,
} from "@/components/mg";
import {
  CtaBanner,
  FaqItem,
  StepCard,
  TestimonialCard,
} from "../_components";

export async function generateMetadata() {
  const t = await getTranslations("marketing");
  return {
    title: t("candidats.metaTitle"),
    description: t("candidats.metaDescription"),
  };
}

const STEP_KEYS = ["step1", "step2", "step3", "step4", "step5"] as const;
const STEP_ICONS = ["users", "file-text", "shield-check", "sparkles", "arrow-up-right"] as const;

const BENEFIT_KEYS = ["b1", "b2", "b3", "b4"] as const;
const BENEFIT_ICONS = [
  "check-circle-2",
  "shield-check",
  "message-circle",
  "sparkles",
] as const;

const MATCH_KEYS = ["skills", "languages", "sector", "mobility"] as const;
const MATCH_SCORES: Record<(typeof MATCH_KEYS)[number], number> = {
  skills: 92,
  languages: 88,
  sector: 95,
  mobility: 72,
};

const STORY_KEYS = ["t1", "t2"] as const;
const STORY_SCORES: Record<(typeof STORY_KEYS)[number], number> = { t1: 91, t2: 84 };

export default async function CandidatsPage() {
  const t = await getTranslations("marketing");

  return (
    <PublicShell active="candidats">
      {/* Hero */}
      <div
        className="px-4 md:px-8 py-12 md:py-16"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,123,85,0.06) 0%, hsl(var(--background)) 100%)",
        }}
      >
        <div
          className="mx-auto grid w-full max-w-[1120px] grid-cols-1 items-center gap-10 md:grid-cols-[1.1fr_0.9fr] md:gap-14"
        >
          <div>
            <Badge tone="success" size="md" icon="users" style={{ marginBottom: 20 }}>
              {t("candidats.hero.badge")}
            </Badge>
            <h1 className="mg-display" style={{ margin: 0, maxWidth: 540 }}>
              {t("candidats.hero.titlePart1")}
              <br />
              <span style={{ color: "hsl(var(--success))" }}>
                {t("candidats.hero.titleHighlight")}
              </span>
              {t("candidats.hero.titleSuffix")}
            </h1>
            <p
              className="mg-body-lg"
              style={{
                margin: "20px 0 0",
                color: "hsl(var(--muted-foreground))",
                maxWidth: 480,
              }}
            >
              {t("candidats.hero.subtitle")}
            </p>
            <Stack dir="row" gap={12} style={{ marginTop: 32 }} wrap>
              <Link href="/sign-up" className="no-underline">
                <Button size="lg" variant="success" iconRight="arrow-right">
                  {t("candidats.cta.primary")}
                </Button>
              </Link>
              <Link href="/sign-up" className="no-underline">
                <Button size="lg" variant="outline">
                  {t("cta.viewOffers")}
                </Button>
              </Link>
            </Stack>
          </div>
          <Card padding={28} elevation={2}>
            <Stack dir="row" gap={16} align="center">
              <ScoreGauge value={87} size={72} stroke={6} />
              <div>
                <div className="mg-micro" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {t("candidats.hero.matchEyebrow")}
                </div>
                <div className="mg-h3" style={{ margin: "4px 0 0" }}>
                  {t("candidats.hero.matchTitle")}
                </div>
                <div
                  className="mg-caption"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {t("candidats.hero.matchRole")}
                </div>
              </div>
            </Stack>
            <Hairline style={{ margin: "20px 0" }} />
            <div style={{ display: "grid", gap: 10 }}>
              {MATCH_KEYS.map((key) => {
                const score = MATCH_SCORES[key];
                return (
                  <div key={key}>
                    <Stack
                      dir="row"
                      justify="space-between"
                      align="center"
                      style={{ marginBottom: 4 }}
                    >
                      <span className="mg-body-sm" style={{ fontWeight: 500 }}>
                        {t(`candidats.hero.match.${key}`)}
                      </span>
                      <span
                        className="mg-tabular mg-caption"
                        style={{ color: "hsl(var(--muted-foreground))" }}
                      >
                        {score}
                      </span>
                    </Stack>
                    <Progress
                      value={score}
                      tone={score >= 80 ? "success" : "primary"}
                      height={4}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Process — 5 steps */}
      <Section padY={96}>
        <SectionHeader
          eyebrow={t("candidats.steps.eyebrow")}
          title={t("candidats.steps.title")}
          align="center"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {STEP_KEYS.map((key, i) => (
            <StepCard
              key={key}
              n={i + 1}
              title={t(`candidats.steps.${key}.title`)}
              body={t(`candidats.steps.${key}.body`)}
              icon={STEP_ICONS[i]}
            />
          ))}
        </div>
      </Section>

      {/* Benefits split */}
      <Section padY={96} surface={2}>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-10 md:gap-14 items-center">
          <div>
            <SectionHeader
              eyebrow={t("candidats.benefits.eyebrow")}
              title={t("candidats.benefits.title")}
              subtitle={t("candidats.benefits.subtitle")}
              maxWidth={420}
            />
            <div style={{ display: "grid", gap: 16 }}>
              {BENEFIT_KEYS.map((key, i) => (
                <Stack key={key} dir="row" gap={16} align="flex-start">
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: "var(--success-bg)",
                      color: "hsl(var(--success))",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={BENEFIT_ICONS[i]} size={16} />
                  </div>
                  <div>
                    <div className="mg-body" style={{ fontWeight: 600 }}>
                      {t(`candidats.benefits.${key}.title`)}
                    </div>
                    <div
                      className="mg-body-sm"
                      style={{ color: "hsl(var(--muted-foreground))", marginTop: 2 }}
                    >
                      {t(`candidats.benefits.${key}.body`)}
                    </div>
                  </div>
                </Stack>
              ))}
            </div>
          </div>
          <Card padding={32} elevation={2}>
            <div
              className="mg-micro"
              style={{ color: "hsl(var(--muted-foreground))", marginBottom: 12 }}
            >
              {t("candidats.sample.eyebrow")}
            </div>
            <Stack dir="row" gap={12} align="center" style={{ marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  color: "hsl(var(--primary))",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="building-2" size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="mg-h3" style={{ margin: 0 }}>
                  {t("candidats.sample.role")}
                </div>
                <div
                  className="mg-caption"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {t("candidats.sample.company")}
                </div>
              </div>
              <ScoreGauge value={78} size={56} />
            </Stack>
            <Stack dir="row" gap={6} wrap style={{ marginBottom: 20 }}>
              <Badge tone="neutral" icon="map-pin">
                {t("candidats.sample.location")}
              </Badge>
              <Badge tone="neutral" icon="briefcase">
                {t("candidats.sample.contract")}
              </Badge>
              <Badge tone="neutral" icon="calendar">
                {t("candidats.sample.start")}
              </Badge>
              <Badge tone="success" icon="check-circle-2">
                {t("candidats.sample.housing")}
              </Badge>
            </Stack>
            <Hairline style={{ marginBottom: 16 }} />
            <div
              className="mg-body-sm"
              style={{ color: "hsl(var(--muted-foreground))", lineHeight: "22px" }}
            >
              {t("candidats.sample.description")}
            </div>
            <Link href="/sign-up" className="no-underline">
              <Button fullWidth style={{ marginTop: 20 }} iconRight="arrow-right">
                {t("candidats.sample.cta")}
              </Button>
            </Link>
          </Card>
        </div>
      </Section>

      {/* Stories */}
      <Section padY={96}>
        <SectionHeader
          eyebrow={t("candidats.stories.eyebrow")}
          title={t("candidats.stories.title")}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {STORY_KEYS.map((key) => (
            <TestimonialCard
              key={key}
              quote={t(`candidats.stories.${key}.quote`)}
              name={t(`candidats.stories.${key}.name`)}
              role={t(`candidats.stories.${key}.role`)}
              score={STORY_SCORES[key]}
            />
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section padY={96} surface={2}>
        <SectionHeader
          eyebrow={t("candidats.faq.eyebrow")}
          title={t("candidats.faq.title")}
          align="center"
        />
        <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gap: 12 }}>
          <FaqItem
            open
            q={t("candidats.faq.q1.q")}
            a={t("candidats.faq.q1.a")}
          />
          <FaqItem q={t("candidats.faq.q2.q")} a={t("candidats.faq.q2.a")} />
          <FaqItem q={t("candidats.faq.q3.q")} a={t("candidats.faq.q3.a")} />
          <FaqItem q={t("candidats.faq.q4.q")} a={t("candidats.faq.q4.a")} />
        </div>
      </Section>

      {/* CTA */}
      <Section padY={80}>
        <CtaBanner
          title={t("candidats.cta.title")}
          body={t("candidats.cta.body")}
          primary={t("candidats.cta.primary")}
          primaryHref="/sign-up?role=candidate"
          secondary={t("candidats.cta.secondary")}
          secondaryHref="/contact"
        />
      </Section>
    </PublicShell>
  );
}
