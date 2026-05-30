import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PublicShell, Section, SectionHeader, Card, Stack } from "@/components/mg";
import { LEGAL_ENTITY } from "@/lib/legal-entity";

export async function generateMetadata() {
  const t = await getTranslations("marketing");
  return {
    title: t("legal.conditions.metaTitle"),
    description: t("legal.conditions.metaDescription"),
  };
}

const linkStyle = { color: "hsl(var(--primary))", textDecoration: "underline" };

export default async function ConditionsPage() {
  const t = await getTranslations("marketing");
  return (
    <PublicShell active={null}>
      <Section padY={80}>
        <SectionHeader title={t("legal.conditions.title")} align="left" />
        <Stack gap={24} style={{ marginTop: 32, maxWidth: 720 }}>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.conditions.objet.title")}
            </h2>
            <p className="mg-body">{t("legal.conditions.objet.body")}</p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.conditions.gratuite.title")}
            </h2>
            <p className="mg-body" style={{ marginBottom: 12 }}>
              {t("legal.conditions.gratuite.body")}
            </p>
            <Link href="/tarifs" className="mg-body-sm" style={linkStyle}>
              {t("legal.conditions.gratuite.linkLabel")}
            </Link>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.conditions.entreprises.title")}
            </h2>
            <p className="mg-body">{t("legal.conditions.entreprises.body")}</p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.conditions.liability.title")}
            </h2>
            <p className="mg-body">{t("legal.conditions.liability.body")}</p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.conditions.governingLaw.title")}
            </h2>
            <p className="mg-body">{t("legal.conditions.governingLaw.body")}</p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.conditions.disputes.title")}
            </h2>
            <p className="mg-body">
              {t("legal.conditions.disputes.body", { email: LEGAL_ENTITY.email.legal })}
            </p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.conditions.resiliation.title")}
            </h2>
            <p className="mg-body" style={{ marginBottom: 12 }}>
              {t("legal.conditions.resiliation.body")}
            </p>
            <Link href="/legal/confidentialite" className="mg-body-sm" style={linkStyle}>
              {t("legal.conditions.resiliation.linkLabel")}
            </Link>
          </Card>
          <p className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
            {t("legal.conditions.updated")} {LEGAL_ENTITY.lastUpdated}
          </p>
        </Stack>
      </Section>
    </PublicShell>
  );
}
