import {
  Avatar,
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
import {
  CountryCard,
  CtaBanner,
  FaqItem,
  SectorCard,
  StepCard,
  TestimonialCard,
} from "./_components";

export const metadata = {
  title:
    "MG·Work — La mobilité du travail entre Madagascar et l'océan Indien",
  description:
    "Plateforme sérieuse de mise en relation entre candidats malgaches et entreprises de Maurice, La Réunion et Seychelles. Conforme DPA Mauritius 2017.",
};

function HomeHero() {
  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, rgba(26,60,110,0.06) 0%, hsl(var(--background)) 100%)",
        padding: "64px 32px 64px",
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
          <Badge tone="primary" size="md" icon="shield-check" style={{ marginBottom: 20 }}>
            Conforme DPA Mauritius 2017
          </Badge>
          <h1 className="mg-display" style={{ margin: 0, maxWidth: 540 }}>
            La mobilité du travail
            <br />
            entre Madagascar et l&apos;
            <span style={{ color: "hsl(var(--primary))" }}>océan Indien</span>.
          </h1>
          <p
            className="mg-body-lg"
            style={{
              margin: "20px 0 0",
              color: "hsl(var(--muted-foreground))",
              maxWidth: 480,
            }}
          >
            Une plateforme sérieuse pour mettre en relation candidats malgaches et entreprises en
            Maurice, La Réunion et aux Seychelles.
          </p>
          <Stack dir="row" gap={12} style={{ marginTop: 32 }}>
            <Button size="lg" iconRight="arrow-right">
              Je suis candidat
            </Button>
            <Button size="lg" variant="outline" iconRight="arrow-up-right">
              Je recrute
            </Button>
          </Stack>
          <div
            style={{
              marginTop: 40,
              display: "flex",
              gap: 32,
              alignItems: "center",
            }}
          >
            <div>
              <div
                className="mg-tabular"
                style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}
              >
                1 240+
              </div>
              <div
                className="mg-caption"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                candidats placés
              </div>
            </div>
            <Hairline vertical style={{ height: 32 }} />
            <div>
              <div
                className="mg-tabular"
                style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}
              >
                87
              </div>
              <div
                className="mg-caption"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                entreprises partenaires
              </div>
            </div>
            <Hairline vertical style={{ height: 32 }} />
            <div>
              <div
                className="mg-tabular"
                style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}
              >
                3
              </div>
              <div
                className="mg-caption"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                pays couverts
              </div>
            </div>
          </div>
        </div>
        <div style={{ position: "relative", height: 360 }}>
          <Card
            elevation={2}
            style={{ position: "absolute", top: 36, left: 0, right: 24, transform: "rotate(-2deg)" }}
          >
            <Stack dir="row" gap={16} align="center">
              <Avatar name="Tahiry Razafy" size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mg-h4">Tahiry R.</div>
                <div
                  className="mg-caption"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  Antananarivo · Hôtellerie
                </div>
              </div>
              <ScoreGauge value={87} size={56} />
            </Stack>
            <Hairline style={{ margin: "16px 0" }} />
            <div
              className="mg-caption"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              Pour
            </div>
            <div className="mg-body-sm" style={{ fontWeight: 600, marginTop: 2 }}>
              Réceptionniste · Hôtel Lux, Maurice
            </div>
          </Card>
          <Card
            elevation={2}
            style={{ position: "absolute", top: 130, left: 64, right: -16, transform: "rotate(1.5deg)" }}
          >
            <Stack dir="row" gap={16} align="center">
              <Avatar name="Naina Andriana" size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mg-h4">Naina A.</div>
                <div
                  className="mg-caption"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  Mahajanga · Construction
                </div>
              </div>
              <ScoreGauge value={74} size={56} />
            </Stack>
            <Hairline style={{ margin: "16px 0" }} />
            <div
              className="mg-caption"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              Pour
            </div>
            <div className="mg-body-sm" style={{ fontWeight: 600, marginTop: 2 }}>
              Charpentier · BTP Réunion SA
            </div>
          </Card>
          <Card
            elevation={2}
            style={{ position: "absolute", top: 234, left: 24, right: 8, transform: "rotate(-0.8deg)" }}
          >
            <Stack dir="row" gap={16} align="center">
              <Avatar name="Iary Rakoto" size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mg-h4">Iary R.</div>
                <div
                  className="mg-caption"
                  style={{ color: "hsl(var(--muted-foreground))" }}
                >
                  Toamasina · Santé
                </div>
              </div>
              <ScoreGauge value={92} size={56} />
            </Stack>
            <Hairline style={{ margin: "16px 0" }} />
            <div
              className="mg-caption"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              Pour
            </div>
            <div className="mg-body-sm" style={{ fontWeight: 600, marginTop: 2 }}>
              Aide-soignant · Clinique Seychelles
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const SECTORS = [
  { icon: "briefcase" as const, name: "Hôtellerie", jobs: 312, growth: "+24%" },
  { icon: "building-2" as const, name: "Construction", jobs: 248, growth: "+18%" },
  { icon: "stethoscope" as const, name: "Santé", jobs: 184, growth: "+31%" },
  { icon: "star" as const, name: "Restauration", jobs: 156, growth: "+12%" },
  { icon: "shield-check" as const, name: "Sécurité", jobs: 92, growth: "+8%" },
  { icon: "home" as const, name: "Domestique", jobs: 78, growth: "+15%" },
];

const PILLARS = [
  {
    icon: "users" as const,
    title: "Profils vérifiés",
    body:
      "Identité, diplômes et autorisations contrôlés par notre équipe avant chaque match.",
  },
  {
    icon: "sparkles" as const,
    title: "Matching transparent",
    body:
      "Chaque score est expliqué : compétences, langues, secteur, mobilité géographique.",
  },
  {
    icon: "shield-check" as const,
    title: "Conformité régionale",
    body: "Conformité DPA Mauritius 2017 et accompagnement KYC pour les entreprises.",
  },
];

const NUMBERS = [
  { v: "1 240+", l: "candidats placés" },
  { v: "87", l: "entreprises partenaires" },
  { v: "14 j", l: "délai moyen au départ" },
  { v: "94 %", l: "taux de rétention 6 mois" },
];

export default function HomePage() {
  return (
    <PublicShell active={null}>
      <HomeHero />

      {/* Logos / trust strip */}
      <div
        style={{
          background: "hsl(var(--surface-2))",
          borderTop: "1px solid hsl(var(--border))",
          borderBottom: "1px solid hsl(var(--border))",
          padding: "24px 32px",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 32,
          }}
        >
          <span
            className="mg-caption"
            style={{ color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}
          >
            Ils nous font confiance
          </span>
          <Stack dir="row" gap={48} align="center" wrap>
            {["HÔTEL LUX", "CLINIQUE ATLANTIS", "BTP RÉUNION", "SUCRIÈRE MU", "CONSTANCE", "BEACHCOMBER"].map(
              (b) => (
                <div
                  key={b}
                  className="mg-micro"
                  style={{ color: "hsl(var(--muted-foreground))", letterSpacing: "0.08em" }}
                >
                  {b}
                </div>
              ),
            )}
          </Stack>
        </div>
      </div>

      {/* How it works — split */}
      <Section padY={96}>
        <SectionHeader
          eyebrow="Comment ça marche"
          title="Une plateforme, deux parcours"
          subtitle="Côté candidat, vous postulez en quelques minutes. Côté entreprise, vous recevez des profils déjà vérifiés."
          align="center"
          maxWidth={620}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>
          <div>
            <Badge tone="info" size="md" icon="users" style={{ marginBottom: 16 }}>
              Côté candidat
            </Badge>
            <h3 className="mg-h2" style={{ margin: "0 0 24px" }}>
              Trouvez un poste à l&apos;étranger
            </h3>
            <div style={{ display: "grid", gap: 12 }}>
              <StepCard
                n={1}
                title="Créez votre profil"
                body="Identité, expériences, langues, secteur recherché. 10 minutes."
                icon="users"
              />
              <StepCard
                n={2}
                title="Recevez des matchs"
                body="Notre moteur croise vos critères avec les offres ouvertes."
                icon="sparkles"
              />
              <StepCard
                n={3}
                title="Décollez"
                body="Documents, visa, logement : un conseiller vous suit jusqu'au départ."
                icon="arrow-up-right"
              />
            </div>
          </div>
          <div>
            <Badge tone="primary" size="md" icon="building-2" style={{ marginBottom: 16 }}>
              Côté entreprise
            </Badge>
            <h3 className="mg-h2" style={{ margin: "0 0 24px" }}>
              Recrutez en confiance
            </h3>
            <div style={{ display: "grid", gap: 12 }}>
              <StepCard
                n={1}
                title="Publiez votre offre"
                body="Décrivez le poste, les compétences, les langues. Validation KYC en 48 h."
                icon="briefcase"
              />
              <StepCard
                n={2}
                title="Recevez des profils notés"
                body="Chaque candidat est noté de 0 à 100. PII masqué avant présélection."
                icon="shield-check"
              />
              <StepCard
                n={3}
                title="Concluez"
                body="Entretiens, contrat, embarquement : notre équipe sécurise chaque étape."
                icon="check-circle-2"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Pillars */}
      <Section padY={80} surface={2}>
        <SectionHeader
          eyebrow="Pourquoi MG·Work"
          title="Sérieux, transparent, conforme"
          align="center"
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {PILLARS.map((p) => (
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

      {/* Sectors */}
      <Section padY={96}>
        <SectionHeader
          eyebrow="Secteurs qui recrutent"
          title="Des opportunités dans 6 industries"
          subtitle="Les postes les plus actifs ce trimestre, tous pays confondus."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {SECTORS.map((s) => (
            <SectorCard key={s.name} {...s} />
          ))}
        </div>
        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Button variant="outline" iconRight="arrow-right">
            Voir tous les secteurs
          </Button>
        </div>
      </Section>

      {/* Countries */}
      <Section padY={96} surface={2}>
        <SectionHeader eyebrow="Pays couverts" title="L'océan Indien, à portée" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          <CountryCard
            name="Maurice"
            label="Île Maurice · MU"
            flagColors={["#1A3C6E", "#007B55"]}
            stats={[
              { value: "52", label: "entreprises" },
              { value: "720+", label: "placements" },
              { value: "14 j", label: "délai moyen" },
              { value: "12", label: "secteurs" },
            ]}
          />
          <CountryCard
            name="La Réunion"
            label="DOM-TOM · FR"
            flagColors={["#1373B0", "#5B3D8B"]}
            stats={[
              { value: "23", label: "entreprises" },
              { value: "310+", label: "placements" },
              { value: "18 j", label: "délai moyen" },
              { value: "8", label: "secteurs" },
            ]}
          />
          <CountryCard
            name="Seychelles"
            label="Mahé · SC"
            flagColors={["#007B55", "#DC8A12"]}
            stats={[
              { value: "12", label: "entreprises" },
              { value: "210+", label: "placements" },
              { value: "22 j", label: "délai moyen" },
              { value: "6", label: "secteurs" },
            ]}
          />
        </div>
      </Section>

      {/* Testimonials */}
      <Section padY={96}>
        <SectionHeader
          eyebrow="Témoignages"
          title="Ils ont trouvé leur place"
          align="center"
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          <TestimonialCard
            quote="Le suivi a vraiment fait la différence. Documents, visa, logement — tout était prêt avant mon départ pour Maurice."
            name="Tahiry Razafy"
            role="Réceptionniste · Hôtel Lux"
            score={91}
          />
          <TestimonialCard
            quote="On reçoit des profils déjà notés et déjà vérifiés. Notre temps de recrutement est passé de 6 semaines à 2."
            name="Camille Léonard"
            role="DRH · Hôtel Lux Maurice"
          />
          <TestimonialCard
            quote="Premier matin à La Réunion, j'avais mon contrat, mon logement et ma carte de séjour. Je n'ai jamais été aussi serein."
            name="Naina Andriana"
            role="Charpentier · BTP Réunion SA"
            score={84}
          />
        </div>
      </Section>

      {/* Numbers */}
      <Section padY={80} surface={2}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32 }}>
          {NUMBERS.map((s) => (
            <div key={s.l} style={{ textAlign: "center" }}>
              <div
                className="mg-tabular"
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  color: "hsl(var(--primary))",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                {s.v}
              </div>
              <div
                className="mg-body-sm"
                style={{ color: "hsl(var(--muted-foreground))", marginTop: 8 }}
              >
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section padY={96}>
        <SectionHeader
          eyebrow="FAQ"
          title="Vos questions, nos réponses"
          align="center"
        />
        <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gap: 12 }}>
          <FaqItem
            open
            q="MG·Work est-il payant pour les candidats ?"
            a="Non. La création de profil, le matching et l'accompagnement administratif sont entièrement gratuits pour les candidats. Notre revenu vient des entreprises."
          />
          <FaqItem q="Combien de temps faut-il pour trouver un poste ?" />
          <FaqItem q="Comment vérifiez-vous l'identité des candidats ?" />
          <FaqItem q="Quels pays sont couverts ?" />
          <FaqItem q="Et après le départ ?" />
        </div>
      </Section>

      {/* CTA */}
      <Section padY={80}>
        <CtaBanner
          title="Prêt à franchir le pas ?"
          body="Inscription en 5 minutes. Sans engagement, sans frais cachés."
          primary="Créer mon compte"
          secondary="Parler à un conseiller"
        />
      </Section>
    </PublicShell>
  );
}
