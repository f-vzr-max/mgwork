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

export const metadata = {
  title: "MG·Work — Pour les candidats",
  description:
    "Postulez à des offres vérifiées en Maurice, La Réunion et Seychelles. Inscription gratuite, conseiller dédié, suivi jusqu'au départ.",
};

const STEPS = [
  { n: 1, title: "Inscription", body: "Compte créé en 5 minutes, vérification par SMS.", icon: "users" as const },
  { n: 2, title: "Profil", body: "Compétences, langues, secteur, mobilité.", icon: "file-text" as const },
  { n: 3, title: "Vérification", body: "Identité et diplômes contrôlés sous 48 h.", icon: "shield-check" as const },
  { n: 4, title: "Matchs", body: "Offres triées et notées selon vos critères.", icon: "sparkles" as const },
  { n: 5, title: "Départ", body: "Visa, logement, contrat — suivi jusqu'au J-1.", icon: "arrow-up-right" as const },
];

const BENEFITS = [
  { icon: "check-circle-2" as const, title: "Gratuit, toujours", body: "Aucun frais pour les candidats — jamais." },
  { icon: "shield-check" as const, title: "Offres vérifiées", body: "Chaque entreprise passe par notre KYC." },
  { icon: "message-circle" as const, title: "Conseiller dédié", body: "Un humain joignable, en français ou en malgache." },
  { icon: "sparkles" as const, title: "Score transparent", body: "Vous savez pourquoi vous matchez, ou pas." },
];

const MATCH_BREAKDOWN: { label: string; score: number }[] = [
  { label: "Compétences", score: 92 },
  { label: "Langues", score: 88 },
  { label: "Secteur", score: 95 },
  { label: "Mobilité", score: 72 },
];

export default function CandidatsPage() {
  return (
    <PublicShell active="candidats">
      {/* Hero */}
      <div
        style={{
          background:
            "linear-gradient(180deg, rgba(0,123,85,0.06) 0%, hsl(var(--background)) 100%)",
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
            <Badge tone="success" size="md" icon="users" style={{ marginBottom: 20 }}>
              Pour les candidats
            </Badge>
            <h1 className="mg-display" style={{ margin: 0, maxWidth: 540 }}>
              Travaillez à l&apos;étranger,
              <br />
              <span style={{ color: "hsl(var(--success))" }}>sereinement</span>.
            </h1>
            <p
              className="mg-body-lg"
              style={{
                margin: "20px 0 0",
                color: "hsl(var(--muted-foreground))",
                maxWidth: 480,
              }}
            >
              Postulez à des offres vérifiées en Maurice, La Réunion et Seychelles. Un conseiller dédié
              vous accompagne du dossier jusqu&apos;au premier jour de travail.
            </p>
            <Stack dir="row" gap={12} style={{ marginTop: 32 }}>
              <Button size="lg" variant="success" iconRight="arrow-right">
                Créer mon profil
              </Button>
              <Button size="lg" variant="outline">
                Voir les offres
              </Button>
            </Stack>
          </div>
          <Card padding={28} elevation={2}>
            <Stack dir="row" gap={16} align="center">
              <ScoreGauge value={87} size={72} stroke={6} />
              <div>
                <div className="mg-micro" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Votre dernier match
                </div>
                <div className="mg-h3" style={{ margin: "4px 0 0" }}>
                  Très bon match
                </div>
                <div
                  className="mg-caption"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  Réceptionniste · Hôtel Lux, Maurice
                </div>
              </div>
            </Stack>
            <Hairline style={{ margin: "20px 0" }} />
            <div style={{ display: "grid", gap: 10 }}>
              {MATCH_BREAKDOWN.map((c) => (
                <div key={c.label}>
                  <Stack
                    dir="row"
                    justify="space-between"
                    align="center"
                    style={{ marginBottom: 4 }}
                  >
                    <span className="mg-body-sm" style={{ fontWeight: 500 }}>
                      {c.label}
                    </span>
                    <span
                      className="mg-tabular mg-caption"
                      style={{ color: "hsl(var(--muted-foreground))" }}
                    >
                      {c.score}
                    </span>
                  </Stack>
                  <Progress
                    value={c.score}
                    tone={c.score >= 80 ? "success" : "primary"}
                    height={4}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Process — 5 steps */}
      <Section padY={96}>
        <SectionHeader
          eyebrow="Votre parcours"
          title="5 étapes, un accompagnement"
          align="center"
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {STEPS.map((s) => (
            <StepCard key={s.n} {...s} />
          ))}
        </div>
      </Section>

      {/* Benefits split */}
      <Section padY={96} surface={2}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr",
            gap: 56,
            alignItems: "center",
          }}
        >
          <div>
            <SectionHeader
              eyebrow="Pour vous"
              title="Ce que MG·Work change"
              subtitle="Une plateforme pensée pour les candidats malgaches, pas une copie d'un job board européen."
              maxWidth={420}
            />
            <div style={{ display: "grid", gap: 16 }}>
              {BENEFITS.map((b) => (
                <Stack key={b.title} dir="row" gap={16} align="flex-start">
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
                    <Icon name={b.icon} size={16} />
                  </div>
                  <div>
                    <div className="mg-body" style={{ fontWeight: 600 }}>
                      {b.title}
                    </div>
                    <div
                      className="mg-body-sm"
                      style={{ color: "hsl(var(--muted-foreground))", marginTop: 2 }}
                    >
                      {b.body}
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
              Exemple d&apos;offre · 3 / 142
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
                  Aide-soignant
                </div>
                <div
                  className="mg-caption"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  Clinique Atlantis · Seychelles
                </div>
              </div>
              <ScoreGauge value={78} size={56} />
            </Stack>
            <Stack dir="row" gap={6} wrap style={{ marginBottom: 20 }}>
              <Badge tone="neutral" icon="map-pin">
                Mahé
              </Badge>
              <Badge tone="neutral" icon="briefcase">
                CDI
              </Badge>
              <Badge tone="neutral" icon="calendar">
                Mars 2026
              </Badge>
              <Badge tone="success" icon="check-circle-2">
                Logement
              </Badge>
            </Stack>
            <Hairline style={{ marginBottom: 16 }} />
            <div
              className="mg-body-sm"
              style={{ color: "hsl(var(--muted-foreground))", lineHeight: "22px" }}
            >
              CDI · 1 800 €/mois net · Visa, billet et logement pris en charge. Diplôme
              d&apos;aide-soignant exigé. Anglais B1.
            </div>
            <Button fullWidth style={{ marginTop: 20 }} iconRight="arrow-right">
              Postuler
            </Button>
          </Card>
        </div>
      </Section>

      {/* Stories */}
      <Section padY={96}>
        <SectionHeader eyebrow="Histoires" title="Ils ont franchi le pas" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }}>
          <TestimonialCard
            quote="J'avais peur de partir, surtout pour la paperasse. Mon conseiller a tout suivi. Aujourd'hui je travaille à Maurice et j'envoie un peu chaque mois à ma famille."
            name="Tahiry Razafy"
            role="Antananarivo → Maurice · Hôtellerie"
            score={91}
          />
          <TestimonialCard
            quote="C'est la seule plateforme où le score est expliqué. J'ai pu améliorer mon profil (anglais, certifications) et passer de 64 à 84 en deux mois."
            name="Naina Andriana"
            role="Mahajanga → La Réunion · BTP"
            score={84}
          />
        </div>
      </Section>

      {/* FAQ */}
      <Section padY={96} surface={2}>
        <SectionHeader eyebrow="FAQ" title="Vos questions" align="center" />
        <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gap: 12 }}>
          <FaqItem
            open
            q="Combien coûte l'inscription ?"
            a="Rien. La plateforme est entièrement gratuite pour les candidats : création de profil, matching, accompagnement administratif, suivi au départ. Notre revenu vient des entreprises qui recrutent via MG·Work."
          />
          <FaqItem q="Combien de temps avant de partir ?" />
          <FaqItem q="Et si je ne parle pas anglais ?" />
          <FaqItem q="Qui s'occupe du visa et du logement ?" />
        </div>
      </Section>

      {/* CTA */}
      <Section padY={80}>
        <CtaBanner
          title="Votre prochain poste vous attend."
          body="Créez votre profil en 5 minutes. Gratuit, sans engagement."
          primary="Créer mon profil"
          secondary="Parler à un conseiller"
        />
      </Section>
    </PublicShell>
  );
}
