"use client";

import * as React from "react";
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

interface Tier {
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  priceSub: string;
  ribbon: string;
  tagline: string;
  cta: string;
  ctaVariant: ButtonVariant;
  featured?: boolean;
  features: { ok: boolean; label: string }[];
  feeNote: string;
}

const TIERS: Tier[] = [
  {
    name: "Starter",
    monthlyPrice: "0 €",
    annualPrice: "0 €",
    priceSub: "/ mois",
    ribbon: "À la performance",
    tagline: "Pour 1–3 recrutements par an.",
    cta: "Commencer",
    ctaVariant: "outline",
    features: [
      { ok: true, label: "Publication de 1 offre active" },
      { ok: true, label: "Jusqu'à 3 présélections / mois" },
      { ok: true, label: "Score de matching expliqué" },
      { ok: true, label: "KYC entreprise inclus" },
      { ok: false, label: "Conseiller dédié" },
      { ok: false, label: "API & webhooks" },
    ],
    feeNote: "Frais de succès : 8 % du brut annuel",
  },
  {
    name: "Business",
    monthlyPrice: "490 €",
    annualPrice: "417 €",
    priceSub: "/ mois",
    ribbon: "Le plus choisi",
    tagline: "Pour les recrutements continus, 1 à 3 par mois.",
    cta: "Démarrer une démo",
    ctaVariant: "default",
    featured: true,
    features: [
      { ok: true, label: "Jusqu'à 6 offres actives" },
      { ok: true, label: "15 présélections / mois" },
      { ok: true, label: "Score de matching expliqué" },
      { ok: true, label: "Conseiller dédié" },
      { ok: true, label: "Suivi post-départ 6 mois" },
      { ok: false, label: "API & webhooks" },
    ],
    feeNote: "Frais de succès : 5 % du brut annuel",
  },
  {
    name: "Enterprise",
    monthlyPrice: "Sur devis",
    annualPrice: "Sur devis",
    priceSub: "",
    ribbon: "Volume & SLA",
    tagline: "Pipeline structuré, intégrations, audit.",
    cta: "Nous contacter",
    ctaVariant: "outline",
    features: [
      { ok: true, label: "Offres illimitées" },
      { ok: true, label: "Présélections illimitées" },
      { ok: true, label: "Pondérations matching sur mesure" },
      { ok: true, label: "Conseiller principal + équipe" },
      { ok: true, label: "Suivi post-départ 12 mois" },
      { ok: true, label: "API, SSO, audit log exporté" },
    ],
    feeNote: "Frais de succès négociés",
  },
];

type FeatureValue = string | boolean;

const FEATURE_ROWS: { f: string; s: FeatureValue; b: FeatureValue; e: FeatureValue }[] = [
  { f: "Offres actives simultanées", s: "1", b: "6", e: "illimité" },
  { f: "Présélections / mois", s: "3", b: "15", e: "illimité" },
  { f: "Score de matching expliqué", s: true, b: true, e: true },
  { f: "PII masqué jusqu'à présélection", s: true, b: true, e: true },
  { f: "KYC entreprise", s: true, b: true, e: true },
  { f: "Multi-utilisateurs", s: "1 siège", b: "5 sièges", e: "illimité" },
  { f: "Conseiller dédié", s: false, b: true, e: true },
  { f: "Suivi post-départ", s: "90 j", b: "6 mois", e: "12 mois" },
  { f: "Pondérations matching sur mesure", s: false, b: false, e: true },
  { f: "API & webhooks", s: false, b: false, e: true },
  { f: "SSO (SAML / OIDC)", s: false, b: false, e: true },
  { f: "Audit log exportable", s: false, b: false, e: true },
  { f: "SLA support", s: "Standard", b: "24h ouvré", e: "4h prioritaire" },
];

export default function TarifsPage() {
  const [cycle, setCycle] = React.useState<Cycle>("monthly");

  return (
    <PublicShell active="tarifs">
      {/* Hero */}
      <div
        style={{
          background:
            "linear-gradient(180deg, rgba(26,60,110,0.06) 0%, hsl(var(--background)) 100%)",
          padding: "72px 32px 40px",
        }}
      >
        <div style={{ maxWidth: 920, margin: "0 auto", textAlign: "center" }}>
          <Badge tone="primary" size="md" style={{ marginBottom: 20 }}>
            Tarifs entreprises
          </Badge>
          <h1 className="mg-display" style={{ margin: 0 }}>
            Un plan pour chaque{" "}
            <span style={{ color: "hsl(var(--primary))" }}>cadence</span> de recrutement.
          </h1>
          <p
            className="mg-body-lg"
            style={{
              margin: "20px auto 0",
              color: "hsl(var(--muted-foreground))",
              maxWidth: 600,
            }}
          >
            Toujours gratuit pour les candidats. Facturé aux entreprises uniquement.
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
            aria-label="Cycle de facturation"
          >
            {(
              [
                { label: "Mensuel", value: "monthly" as const },
                { label: "Annuel · -15%", value: "annual" as const },
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
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tiers */}
      <Section padY={64}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
            alignItems: "stretch",
          }}
        >
          {TIERS.map((t) => {
            const price = cycle === "annual" ? t.annualPrice : t.monthlyPrice;
            return (
              <Card
                key={t.name}
                padding={32}
                style={{
                  position: "relative",
                  border: t.featured
                    ? "2px solid hsl(var(--primary))"
                    : "1px solid hsl(var(--border))",
                  boxShadow: t.featured ? "var(--shadow-md)" : "var(--shadow-sm)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {t.featured && (
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
                    {t.ribbon}
                  </div>
                )}
                <div>
                  <div className="mg-h3" style={{ margin: 0 }}>
                    {t.name}
                  </div>
                  <div
                    className="mg-caption"
                    style={{ color: "hsl(var(--muted-foreground))", marginTop: 4 }}
                  >
                    {t.tagline}
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
                    {t.priceSub}
                  </span>
                </Stack>
                <Button variant={t.ctaVariant} fullWidth iconRight="arrow-right">
                  {t.cta}
                </Button>
                <Hairline />
                <Stack gap={10}>
                  {t.features.map((f) => (
                    <Stack key={f.label} dir="row" gap={10} align="center">
                      <Icon
                        name={f.ok ? "check-circle-2" : "x"}
                        size={16}
                        style={{
                          color: f.ok
                            ? "hsl(var(--success))"
                            : "hsl(var(--muted-foreground))",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        className="mg-body-sm"
                        style={{
                          color: f.ok
                            ? "hsl(var(--foreground))"
                            : "hsl(var(--muted-foreground))",
                        }}
                      >
                        {f.label}
                      </span>
                    </Stack>
                  ))}
                </Stack>
                <div
                  className="mg-caption"
                  style={{
                    color: "hsl(var(--muted-foreground))",
                    marginTop: "auto",
                    paddingTop: 8,
                  }}
                >
                  {t.feeNote}
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      {/* Feature matrix */}
      <Section padY={96} surface={2}>
        <SectionHeader
          eyebrow="Comparatif"
          title="Toutes les fonctionnalités, en détail"
        />
        <Card padding={0}>
          <div
            className="mg-micro"
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr 1fr 1fr",
              padding: "14px 24px",
              background: "hsl(var(--surface-2))",
              borderBottom: "1px solid hsl(var(--border))",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            <span>Fonctionnalité</span>
            <span style={{ textAlign: "center" }}>Starter</span>
            <span style={{ textAlign: "center", color: "hsl(var(--primary))" }}>
              Business
            </span>
            <span style={{ textAlign: "center" }}>Enterprise</span>
          </div>
          {FEATURE_ROWS.map((row, i) => (
            <div
              key={row.f}
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 1fr 1fr 1fr",
                padding: "14px 24px",
                alignItems: "center",
                borderTop: i === 0 ? 0 : "1px solid hsl(var(--border))",
                background: i % 2 === 1 ? "hsl(var(--surface-2))" : undefined,
              }}
            >
              <span className="mg-body-sm">{row.f}</span>
              {(["s", "b", "e"] as const).map((k) => {
                const v = row[k];
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
        <SectionHeader eyebrow="FAQ" title="Questions sur les tarifs" align="center" />
        <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gap: 12 }}>
          <FaqItem
            open
            q="Que comprennent les « frais de succès » ?"
            a="Un pourcentage du salaire brut annuel du candidat embauché, facturé uniquement quand l'embauche est confirmée. C'est notre alignement d'intérêts : nous gagnons quand vous recrutez avec succès."
          />
          <FaqItem q="Puis-je changer de plan en cours d'année ?" />
          <FaqItem q="Les candidats paient-ils quelque chose ?" />
          <FaqItem q="Comment se passe la facturation ?" />
          <FaqItem q="Y a-t-il une période d'engagement ?" />
        </div>
      </Section>

      {/* CTA */}
      <Section padY={80}>
        <CtaBanner
          title="Commencez avec 3 profils gratuits."
          body="Aucune carte requise. Démo personnalisée sous 48 h."
          primary="Demander une démo"
          secondary="Comparer les plans"
        />
      </Section>
    </PublicShell>
  );
}
