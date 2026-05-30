import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PublicShell, Section, SectionHeader, Card, Stack } from "@/components/mg";
import { LEGAL_ENTITY } from "@/lib/legal-entity";

export async function generateMetadata() {
  const t = await getTranslations("marketing");
  return {
    title: t("legal.mentions.metaTitle"),
    description: t("legal.mentions.metaDescription"),
  };
}

export default async function MentionsLegalesPage() {
  const t = await getTranslations("marketing");
  const entity = {
    legalName: LEGAL_ENTITY.legalName,
    brn: LEGAL_ENTITY.brn,
    capital: LEGAL_ENTITY.capital,
    address: LEGAL_ENTITY.registeredAddress,
    operational: LEGAL_ENTITY.operationalAddress,
    incorporated: LEGAL_ENTITY.incorporationDate,
  };
  return (
    <PublicShell active={null}>
      <Section padY={80}>
        <SectionHeader title={t("legal.mentions.title")} align="left" />
        <Stack gap={24} style={{ marginTop: 32, maxWidth: 720 }}>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.mentions.editor.title")}
            </h2>
            <p className="mg-body">{t("legal.mentions.editor.body", entity)}</p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.mentions.director.title")}
            </h2>
            <p className="mg-body">
              {t("legal.mentions.director.body", {
                director: LEGAL_ENTITY.director,
                legalName: LEGAL_ENTITY.legalName,
              })}
            </p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.mentions.hosting.title")}
            </h2>
            <p className="mg-body">{t("legal.mentions.hosting.body")}</p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.mentions.ip.title")}
            </h2>
            <p className="mg-body">
              {t("legal.mentions.ip.body", { legalName: LEGAL_ENTITY.legalName })}
            </p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.mentions.contact.title")}
            </h2>
            <p className="mg-body" style={{ marginBottom: 12 }}>
              {t("legal.mentions.contact.body", { email: LEGAL_ENTITY.email.legal })}
            </p>
            <Link
              href="/legal/confidentialite"
              className="mg-body-sm"
              style={{ color: "hsl(var(--primary))", textDecoration: "underline" }}
            >
              {t("legal.mentions.contact.linkLabel")}
            </Link>
          </Card>
          <p className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
            {t("legal.mentions.updated")} {LEGAL_ENTITY.lastUpdated}
          </p>
        </Stack>
      </Section>
    </PublicShell>
  );
}
