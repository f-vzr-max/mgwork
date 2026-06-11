import type { CSSProperties } from "react";
import { getTranslations } from "next-intl/server";
import { PublicShell, Section, SectionHeader, Card, Stack } from "@/components/mg";
import { LEGAL_ENTITY } from "@/lib/legal-entity";

export async function generateMetadata() {
  const t = await getTranslations("marketing");
  return {
    title: t("legal.cookies.metaTitle"),
    description: t("legal.cookies.metaDescription"),
  };
}

// First-party cookies are listed under the public brand (AsanaoConnect), not
// the legal entity (MG·Work SARL — lib/legal-entity.ts, used in /legal pages
// where the contracting party matters). Cookie NAMES stay unchanged (protected).
const COOKIE_ROWS = [
  { name: "mgwork_lang", provider: "AsanaoConnect", key: "lang", type: "functional" },
  { name: "theme", provider: "AsanaoConnect", key: "theme", type: "functional" },
  {
    name: "__session, __client_uat, __clerk_*",
    provider: "Clerk",
    key: "clerk",
    type: "essential",
  },
] as const;

const cell: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid hsl(var(--border))",
  verticalAlign: "top",
  textAlign: "left",
};

export default async function CookiesPage() {
  const t = await getTranslations("marketing");
  const cols = ["name", "provider", "purpose", "duration", "type"] as const;

  return (
    <PublicShell active={null}>
      <Section padY={80}>
        <SectionHeader
          title={t("legal.cookies.title")}
          subtitle={t("legal.cookies.intro")}
          align="left"
        />
        <Stack gap={24} style={{ marginTop: 32, maxWidth: 820 }}>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.cookies.functional.title")}
            </h2>
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table
                className="mg-body-sm"
                style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}
              >
                <thead>
                  <tr>
                    {cols.map((c) => (
                      <th
                        key={c}
                        className="mg-caption"
                        style={{
                          ...cell,
                          color: "hsl(var(--muted-foreground))",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t(`legal.cookies.cols.${c}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COOKIE_ROWS.map((r) => (
                    <tr key={r.name}>
                      <td className="mg-mono" style={cell}>
                        {r.name}
                      </td>
                      <td style={cell}>{r.provider}</td>
                      <td style={{ ...cell, color: "hsl(var(--muted-foreground))" }}>
                        {t(`legal.cookies.rows.${r.key}.purpose`)}
                      </td>
                      <td style={{ ...cell, whiteSpace: "nowrap" }}>
                        {t(`legal.cookies.rows.${r.key}.duration`)}
                      </td>
                      <td style={cell}>{t(`legal.cookies.type.${r.type}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.cookies.thirdParty.title")}
            </h2>
            <p className="mg-body" style={{ color: "hsl(var(--muted-foreground))" }}>
              {t("legal.cookies.thirdParty.body")}
            </p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-h3" style={{ marginTop: 0 }}>
              {t("legal.cookies.choices.title")}
            </h2>
            <p className="mg-body" style={{ color: "hsl(var(--muted-foreground))" }}>
              {t("legal.cookies.choices.body")}
            </p>
          </Card>
          <p className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
            {t("legal.cookies.updated")} {LEGAL_ENTITY.lastUpdated}
          </p>
        </Stack>
      </Section>
    </PublicShell>
  );
}
