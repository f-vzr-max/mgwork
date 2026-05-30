import { getTranslations } from "next-intl/server";
import { PublicShell, Section, SectionHeader, Card, Stack, Button } from "@/components/mg";
import Link from "next/link";

export async function generateMetadata() {
  const t = await getTranslations("marketing");
  return {
    title: t("aide.metaTitle"),
    description: t("aide.metaDescription"),
  };
}

const FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

export default async function AidePage() {
  const t = await getTranslations("marketing");
  return (
    <PublicShell active={null}>
      <Section padY={80}>
        <SectionHeader
          title={t("aide.title")}
          subtitle={t("aide.subtitle")}
          align="left"
        />
        <Stack gap={12} style={{ marginTop: 32, maxWidth: 760 }}>
          {FAQ_KEYS.map((k) => (
            <Card key={k} padding={24} surface={1}>
              <h3 className="mg-h4" style={{ margin: "0 0 8px" }}>
                {t(`aide.faq.${k}.q`)}
              </h3>
              <p
                className="mg-body"
                style={{ margin: 0, color: "hsl(var(--muted-foreground))" }}
              >
                {t(`aide.faq.${k}.a`)}
              </p>
            </Card>
          ))}
          <Card padding={28} surface={2} style={{ marginTop: 16 }}>
            <Stack gap={12}>
              <h3 className="mg-h4" style={{ margin: 0 }}>
                {t("aide.cta.title")}
              </h3>
              <p
                className="mg-body"
                style={{ margin: 0, color: "hsl(var(--muted-foreground))" }}
              >
                {t("aide.cta.body")}
              </p>
              <div>
                <Link href="/contact" style={{ textDecoration: "none" }}>
                  <Button>{t("aide.cta.button")}</Button>
                </Link>
              </div>
            </Stack>
          </Card>
        </Stack>
      </Section>
    </PublicShell>
  );
}
