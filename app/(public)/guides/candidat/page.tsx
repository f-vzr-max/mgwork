import { getTranslations } from "next-intl/server";
import { PublicShell, Section, SectionHeader, Card, Stack, Button } from "@/components/mg";
import Link from "next/link";

export async function generateMetadata() {
  const t = await getTranslations("marketing");
  return {
    title: t("guides.candidat.metaTitle"),
    description: t("guides.candidat.metaDescription"),
  };
}

const STEP_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6"] as const;

export default async function GuideCandidatPage() {
  const t = await getTranslations("marketing");
  return (
    <PublicShell active={null}>
      <Section padY={80}>
        <SectionHeader
          eyebrow={t("guides.candidat.eyebrow")}
          title={t("guides.candidat.title")}
          subtitle={t("guides.candidat.subtitle")}
          align="left"
        />
        <Stack gap={16} style={{ marginTop: 32, maxWidth: 760 }}>
          {STEP_KEYS.map((k, i) => (
            <Card key={k} padding={28} surface={1}>
              <Stack dir="row" gap={20} align="flex-start">
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    background: "hsl(var(--primary) / 0.1)",
                    color: "hsl(var(--primary))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 className="mg-h4" style={{ margin: "4px 0 8px" }}>
                    {t(`guides.candidat.${k}.title`)}
                  </h3>
                  <p
                    className="mg-body"
                    style={{ margin: 0, color: "hsl(var(--muted-foreground))" }}
                  >
                    {t(`guides.candidat.${k}.body`)}
                  </p>
                </div>
              </Stack>
            </Card>
          ))}
          <div style={{ marginTop: 16 }}>
            <Link href="/sign-up" style={{ textDecoration: "none" }}>
              <Button>{t("guides.candidat.cta")}</Button>
            </Link>
          </div>
        </Stack>
      </Section>
    </PublicShell>
  );
}
