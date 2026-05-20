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

export const metadata = {
  title: "MG·Work — Pour les entreprises",
  description:
    "Recrutez à Madagascar en confiance : profils vérifiés et notés, KYC entreprise en 48h, conformité DPA Mauritius 2017.",
};

const WHY = [
  {
    icon: "shield-check" as const,
    title: "Conformité incluse",
    body:
      "KYC entreprise, vérification d'identité candidat, autorisations de travail. Tout est tracé et audit-ready.",
  },
  {
    icon: "sparkles" as const,
    title: "Matching expliqué",
    body:
      "Vous voyez le score, mais aussi pourquoi : compétences, langues, secteur, mobilité. Pas de boîte noire.",
  },
  {
    icon: "users" as const,
    title: "Equipe locale",
    body:
      "Notre équipe à Antananarivo et Port-Louis suit chaque dossier — pas un chatbot, un humain.",
  },
];

const PROCESS = [
  { n: 1, title: "KYC entreprise", body: "Documents légaux validés sous 48h.", icon: "shield-check" as const },
  { n: 2, title: "Publication", body: "Offre rédigée avec vous, multi-langue.", icon: "briefcase" as const },
  { n: 3, title: "Présélection", body: "Profils notés et anonymisés livrés.", icon: "sparkles" as const },
  { n: 4, title: "Embarquement", body: "Visa, contrat, voyage : nous gérons.", icon: "arrow-up-right" as const },
];

const CASES = [
  {
    co: "Hôtel Lux Maurice",
    sector: "Hôtellerie",
    placements: "34",
    metric: "6 → 2",
    metricLabel: "semaines / recrutement",
    quote:
      "Nous avions un turnover réceptionnistes problématique. MG·Work nous a livré une équipe stable en 4 mois.",
  },
  {
    co: "BTP Réunion SA",
    sector: "Construction",
    placements: "21",
    metric: "94 %",
    metricLabel: "rétention 12 mois",
    quote:
      "Le suivi post-départ change tout : nos nouveaux arrivants restent, contrairement à nos canaux historiques.",
  },
];

const PRICING_TEASE = [
  {
    name: "Starter",
    price: "€ 0",
    sub: "/ recrutement réussi",
    desc: "Pour 1–3 placements par an.",
    cta: "Commencer",
    featured: false,
  },
  {
    name: "Business",
    price: "€ 490",
    sub: "/ mois",
    desc: "Pour les recrutements continus.",
    cta: "Démo",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Sur devis",
    sub: "",
    desc: "Volume, API, audit, SLA.",
    cta: "Contact",
    featured: false,
  },
];

const HERO_MATCHES = [
  { name: "Candidat #2451", city: "Antananarivo", sector: "Hôtellerie", score: 91 },
  { name: "Candidat #2452", city: "Mahajanga", sector: "Hôtellerie", score: 84 },
  { name: "Candidat #2453", city: "Toamasina", sector: "Cuisine", score: 79 },
];

export default function EntreprisesPage() {
  return (
    <PublicShell active="entreprises">
      {/* Hero */}
      <div
        style={{
          background:
            "linear-gradient(180deg, rgba(26,60,110,0.06) 0%, hsl(var(--background)) 100%)",
          padding: "72px 32px 56px",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 56,
            alignItems: "center",
          }}
        >
          <div>
            <Badge tone="primary" size="md" icon="building-2" style={{ marginBottom: 20 }}>
              Pour les entreprises
            </Badge>
            <h1 className="mg-display" style={{ margin: 0, maxWidth: 540 }}>
              Recrutez à Madagascar,
              <br />
              <span style={{ color: "hsl(var(--primary))" }}>en confiance</span>.
            </h1>
            <p
              className="mg-body-lg"
              style={{
                margin: "20px 0 0",
                color: "hsl(var(--muted-foreground))",
                maxWidth: 480,
              }}
            >
              Recevez des profils déjà vérifiés et notés. Nous gérons l&apos;identité, les diplômes,
              l&apos;autorisation de travail et l&apos;embarquement.
            </p>
            <Stack dir="row" gap={12} style={{ marginTop: 32 }}>
              <Button size="lg" iconRight="arrow-right">
                Demander une démo
              </Button>
              <Button size="lg" variant="outline">
                Voir les tarifs
              </Button>
            </Stack>
            <div style={{ marginTop: 32, display: "flex", gap: 24, alignItems: "center" }}>
              <Badge tone="success" icon="check-circle-2">
                KYC en 48h
              </Badge>
              <Badge tone="info" icon="shield-check">
                DPA Mauritius 2017
              </Badge>
              <Badge tone="neutral" icon="globe">
                3 pays
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
                  4 matchs aujourd&apos;hui
                </h3>
                <Badge tone="primary">PII masqué</Badge>
              </Stack>
              <div style={{ display: "grid", gap: 10 }}>
                {HERO_MATCHES.map((m) => (
                  <div
                    key={m.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  >
                    <ScoreGauge value={m.score} size={40} stroke={3} label={false} />
                    <div style={{ flex: 1 }}>
                      <div className="mg-body-sm" style={{ fontWeight: 600 }}>
                        {m.name} · {m.city}
                      </div>
                      <div
                        className="mg-caption"
                        style={{ color: "hsl(var(--muted-foreground))" }}
                      >
                        {m.sector}
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      Présélectionner
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
          eyebrow="Pourquoi nous"
          title="Le recrutement international, sans le risque"
          align="center"
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {WHY.map((p) => (
            <Card key={p.title} padding={28}>
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
                <Icon name={p.icon} size={24} />
              </div>
              <h3 className="mg-h3" style={{ margin: 0 }}>
                {p.title}
              </h3>
              <p
                className="mg-body"
                style={{
                  color: "hsl(var(--muted-foreground))",
                  marginTop: 8,
                  marginBottom: 0,
                }}
              >
                {p.body}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Process */}
      <Section padY={96} surface={2}>
        <SectionHeader
          eyebrow="Comment ça marche"
          title="De l'offre au premier jour"
          align="center"
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {PROCESS.map((s) => (
            <StepCard key={s.n} {...s} />
          ))}
        </div>
      </Section>

      {/* Case studies */}
      <Section padY={96}>
        <SectionHeader eyebrow="Cas clients" title="Ils recrutent avec MG·Work" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }}>
          {CASES.map((c) => (
            <Card key={c.co} padding={28}>
              <Stack
                dir="row"
                justify="space-between"
                align="flex-start"
                style={{ marginBottom: 16 }}
              >
                <div>
                  <div className="mg-h3" style={{ margin: 0 }}>
                    {c.co}
                  </div>
                  <Badge tone="neutral" style={{ marginTop: 6 }}>
                    {c.sector}
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
                    {c.metric}
                  </div>
                  <div
                    className="mg-caption"
                    style={{ color: "hsl(var(--muted-foreground))" }}
                  >
                    {c.metricLabel}
                  </div>
                </div>
              </Stack>
              <p className="mg-body" style={{ color: "hsl(var(--foreground))" }}>
                &ldquo;{c.quote}&rdquo;
              </p>
              <Hairline style={{ margin: "16px 0" }} />
              <Stack dir="row" justify="space-between" align="center">
                <span
                  className="mg-caption"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {c.placements} placements à ce jour
                </span>
                <Button variant="link" iconRight="arrow-right">
                  Lire le cas
                </Button>
              </Stack>
            </Card>
          ))}
        </div>
      </Section>

      {/* Pricing tease */}
      <Section padY={96} surface={2}>
        <SectionHeader
          eyebrow="Tarifs"
          title="Un plan pour chaque taille"
          subtitle="Du recrutement ponctuel au pipeline continu."
          align="center"
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {PRICING_TEASE.map((p) => (
            <Card
              key={p.name}
              padding={28}
              style={
                p.featured
                  ? {
                      borderColor: "hsl(var(--primary))",
                      borderWidth: 2,
                      boxShadow: "var(--shadow-md)",
                    }
                  : undefined
              }
            >
              {p.featured && (
                <Badge tone="primary" style={{ marginBottom: 12 }}>
                  Le plus populaire
                </Badge>
              )}
              <div className="mg-h3" style={{ margin: 0 }}>
                {p.name}
              </div>
              <Stack dir="row" gap={6} align="baseline" style={{ marginTop: 12 }}>
                <span
                  className="mg-tabular"
                  style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em" }}
                >
                  {p.price}
                </span>
                <span
                  className="mg-caption"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  {p.sub}
                </span>
              </Stack>
              <p
                className="mg-body-sm"
                style={{
                  color: "hsl(var(--muted-foreground))",
                  margin: "12px 0 24px",
                }}
              >
                {p.desc}
              </p>
              <Button
                fullWidth
                variant={p.featured ? "default" : "outline"}
                iconRight="arrow-right"
              >
                {p.cta}
              </Button>
            </Card>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section padY={80}>
        <CtaBanner
          title="Recevez 3 profils gratuits en 7 jours."
          body="Démo personnalisée, sans engagement."
          primary="Demander une démo"
          secondary="Voir les tarifs"
        />
      </Section>
    </PublicShell>
  );
}
