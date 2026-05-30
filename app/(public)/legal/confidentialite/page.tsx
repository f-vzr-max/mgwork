import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { PublicShell, Section, SectionHeader, Card, Stack, Badge } from "@/components/mg";
import { LEGAL_ENTITY } from "@/lib/legal-entity";

export async function generateMetadata() {
  const t = await getTranslations("marketing");
  return {
    title: t("legal.confidentialite.metaTitle"),
    description: t("legal.confidentialite.metaDescription"),
  };
}

export default async function ConfidentialitePage() {
  const t = await getTranslations("marketing");
  return (
    <PublicShell active={null}>
      <Section padY={80}>
        <SectionHeader title={t("legal.confidentialite.title")} align="left" />
        <Stack gap={24} style={{ marginTop: 32, maxWidth: 720 }}>
          <Stack dir="row" gap={8} wrap>
            <Badge tone="success" icon="shield-check">
              {t("legal.confidentialite.badge.dpa")}
            </Badge>
            <Badge tone="neutral" icon="globe">
              {t("legal.confidentialite.badge.hosting")}
            </Badge>
          </Stack>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.confidentialite.controller.title")}
            </h2>
            <p className="mg-body">
              {t("legal.confidentialite.controller.body", {
                legalName: LEGAL_ENTITY.legalName,
                address: LEGAL_ENTITY.registeredAddress,
                dpo: LEGAL_ENTITY.email.dpo,
              })}
            </p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.confidentialite.collecte.title")}
            </h2>
            <p className="mg-body">{t("legal.confidentialite.collecte.body")}</p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.confidentialite.finalites.title")}
            </h2>
            <p className="mg-body">{t("legal.confidentialite.finalites.body")}</p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.confidentialite.subprocessors.title")}
            </h2>
            <p className="mg-body">{t("legal.confidentialite.subprocessors.body")}</p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.confidentialite.automated.title")}
            </h2>
            <p className="mg-body">{t("legal.confidentialite.automated.body")}</p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.confidentialite.droits.title")}
            </h2>
            <p className="mg-body">
              {t("legal.confidentialite.droits.body", {
                email: LEGAL_ENTITY.email.privacy,
              })}
            </p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.confidentialite.authority.title")}
            </h2>
            <p className="mg-body">{t("legal.confidentialite.authority.body")}</p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.confidentialite.conservation.title")}
            </h2>
            <p className="mg-body" style={{ marginBottom: 12 }}>
              {t("legal.confidentialite.conservation.body")}
            </p>
            <Link
              href="/conformite"
              className="mg-body-sm"
              style={{ color: "hsl(var(--primary))", textDecoration: "underline" }}
            >
              {t("legal.confidentialite.conservation.linkLabel")}
            </Link>
          </Card>
          <p className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
            {t("legal.confidentialite.updated")} {LEGAL_ENTITY.lastUpdated}
          </p>
        </Stack>
      </Section>
    </PublicShell>
  );
}
