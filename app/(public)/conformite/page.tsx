import * as React from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Badge,
  Button,
  Card,
  Icon,
  PublicShell,
  Section,
  SectionHeader,
  Stack,
  type IconName,
} from "@/components/mg";
import { FaqItem } from "../_components";

export const metadata = {
  title: "MG·Work — Conformité & sécurité des données",
  description:
    "Conformité Data Protection Act Mauritius 2017, PII masqué par défaut, hébergement régional. La conformité par construction.",
};

const PILLAR_KEYS = ["p1", "p2", "p3", "p4"] as const;
const PILLAR_ICONS: IconName[] = ["shield-check", "eye", "file-text", "globe"];

type LifecycleTone = "info" | "warning" | "success" | "neutral";

const LIFECYCLE_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6"] as const;
const LIFECYCLE_META: Record<
  (typeof LIFECYCLE_KEYS)[number],
  { tone: LifecycleTone; icon: IconName }
> = {
  s1: { tone: "info", icon: "upload" },
  s2: { tone: "info", icon: "shield-check" },
  s3: { tone: "info", icon: "sparkles" },
  s4: { tone: "warning", icon: "eye" },
  s5: { tone: "success", icon: "check-circle-2" },
  s6: { tone: "neutral", icon: "file-text" },
};

const RIGHTS_KEYS = ["access", "rectify", "delete", "port", "oppose"] as const;

function toneToBg(tone: LifecycleTone): string {
  switch (tone) {
    case "info":
      return "var(--info-bg)";
    case "warning":
      return "var(--warning-bg)";
    case "success":
      return "var(--success-bg)";
    case "neutral":
      return "var(--neutral-bg)";
  }
}

function toneToFg(tone: LifecycleTone): string {
  switch (tone) {
    case "info":
      return "hsl(var(--info))";
    case "warning":
      return "hsl(var(--warning))";
    case "success":
      return "hsl(var(--success))";
    case "neutral":
      return "hsl(var(--foreground))";
  }
}

export default async function ConformitePage() {
  const t = await getTranslations("marketing");

  return (
    <PublicShell active="conformite">
      {/* Hero */}
      <div
        className="px-4 md:px-8 py-12 md:py-16"
        style={{
          background:
            "linear-gradient(180deg, rgba(19,115,176,0.06) 0%, hsl(var(--background)) 100%)",
        }}
      >
        <div style={{ maxWidth: 920, margin: "0 auto", textAlign: "center" }}>
          <Badge tone="info" size="md" icon="shield-check" style={{ marginBottom: 20 }}>
            {t("conformite.hero.badge")}
          </Badge>
          <h1
            className="mg-display"
            style={{ margin: 0, textWrap: "balance" as React.CSSProperties["textWrap"] }}
          >
            {t("conformite.hero.titlePart1")}
            <br />
            {t("conformite.hero.titlePart2Prefix")}
            <span style={{ color: "hsl(var(--info))" }}>
              {t("conformite.hero.titleHighlight")}
            </span>
            {t("conformite.hero.titleSuffix")}
          </h1>
          <p
            className="mg-body-lg"
            style={{
              margin: "20px auto 0",
              color: "hsl(var(--muted-foreground))",
              maxWidth: 640,
            }}
          >
            {t("conformite.hero.subtitle")}
          </p>
          <Stack dir="row" gap={8} justify="center" style={{ marginTop: 28 }} wrap>
            <Badge tone="success" icon="check-circle-2">
              {t("conformite.hero.badgeDpa")}
            </Badge>
            <Badge tone="success" icon="check-circle-2">
              {t("conformite.hero.badgeIso")}
            </Badge>
            <Badge tone="success" icon="check-circle-2">
              {t("conformite.hero.badgeGdpr")}
            </Badge>
          </Stack>
        </div>
      </div>

      {/* Pillars */}
      <Section padY={96}>
        <SectionHeader
          eyebrow={t("conformite.pillars.eyebrow")}
          title={t("conformite.pillars.title")}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PILLAR_KEYS.map((key, i) => (
            <Card key={key} padding={28}>
              <Stack dir="row" gap={20} align="flex-start">
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    background: "var(--info-bg)",
                    color: "hsl(var(--info))",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name={PILLAR_ICONS[i]!} size={22} />
                </div>
                <div>
                  <h3 className="mg-h3" style={{ margin: 0 }}>
                    {t(`conformite.pillars.${key}.title`)}
                  </h3>
                  <p
                    className="mg-body"
                    style={{ color: "hsl(var(--muted-foreground))", margin: "8px 0 0" }}
                  >
                    {t(`conformite.pillars.${key}.body`)}
                  </p>
                </div>
              </Stack>
            </Card>
          ))}
        </div>
      </Section>

      {/* Lifecycle */}
      <Section padY={96} surface={2}>
        <SectionHeader
          eyebrow={t("conformite.lifecycle.eyebrow")}
          title={t("conformite.lifecycle.title")}
        />
        <Card padding={0}>
          {LIFECYCLE_KEYS.map((key, i) => {
            const { tone, icon } = LIFECYCLE_META[key];
            return (
              <div
                key={key}
                className="grid grid-cols-[40px_1fr] md:grid-cols-[40px_180px_1fr] gap-3 md:gap-5"
                style={{
                  padding: "20px 28px",
                  alignItems: "center",
                  borderTop: i === 0 ? 0 : "1px solid hsl(var(--border))",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9999,
                    background: toneToBg(tone),
                    color: toneToFg(tone),
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </div>
                <Stack dir="row" gap={10} align="center">
                  <Icon
                    name={icon}
                    size={16}
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  />
                  <span className="mg-body" style={{ fontWeight: 600 }}>
                    {t(`conformite.lifecycle.${key}.step`)}
                  </span>
                </Stack>
                <span
                  className="mg-body-sm col-span-2 md:col-span-1"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {t(`conformite.lifecycle.${key}.body`)}
                </span>
              </div>
            );
          })}
        </Card>
      </Section>

      {/* DPO contact */}
      <Section padY={96}>
        <Card padding={48} style={{ background: "hsl(var(--surface-2))" }}>
          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-10 md:gap-12 items-center">
            <div>
              <Badge tone="primary" icon="users" style={{ marginBottom: 12 }}>
                {t("conformite.dpo.badge")}
              </Badge>
              <h3 className="mg-h2" style={{ margin: 0 }}>
                {t("conformite.dpo.title")}
              </h3>
              <p
                className="mg-body-lg"
                style={{
                  color: "hsl(var(--muted-foreground))",
                  margin: "12px 0 24px",
                  maxWidth: 480,
                }}
              >
                {t("conformite.dpo.body")}
              </p>
              <Stack dir="row" gap={12} wrap>
                <a href={`mailto:${t("conformite.dpo.email")}`} className="no-underline">
                  <Button iconLeft="mail">{t("conformite.dpo.email")}</Button>
                </a>
                <Link href="/legal/confidentialite" className="no-underline">
                  <Button variant="outline">{t("conformite.dpo.policy")}</Button>
                </Link>
              </Stack>
            </div>
            <Card padding={24}>
              <div
                className="mg-micro"
                style={{ color: "hsl(var(--muted-foreground))", marginBottom: 12 }}
              >
                {t("conformite.dpo.rightsTitle")}
              </div>
              <Stack gap={8}>
                {RIGHTS_KEYS.map((r) => (
                  <Stack key={r} dir="row" gap={10} align="center">
                    <Icon
                      name="check-circle-2"
                      size={14}
                      style={{ color: "hsl(var(--success))" }}
                    />
                    <span className="mg-body-sm">
                      {t(`conformite.dpo.rights.${r}`)}
                    </span>
                  </Stack>
                ))}
              </Stack>
            </Card>
          </div>
        </Card>
      </Section>

      {/* FAQ */}
      <Section padY={96} surface={2}>
        <SectionHeader
          eyebrow={t("conformite.faq.eyebrow")}
          title={t("conformite.faq.title")}
          align="center"
        />
        <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gap: 12 }}>
          <FaqItem
            open
            q={t("conformite.faq.q1.q")}
            a={t("conformite.faq.q1.a")}
          />
          <FaqItem q={t("conformite.faq.q2.q")} />
          <FaqItem q={t("conformite.faq.q3.q")} />
          <FaqItem q={t("conformite.faq.q4.q")} />
        </div>
      </Section>
    </PublicShell>
  );
}
