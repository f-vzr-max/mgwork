import { PublicShell, Section, SectionHeader, Card, Stack, Button } from "@/components/mg";
import Link from "next/link";

export const metadata = {
  title: "MG·Work — Guide entreprise",
  description:
    "Le parcours entreprise MG·Work pas à pas : KYC, offre, embauche.",
};

const STEPS = [
  {
    n: "1",
    title: "Validation KYC (48 h)",
    body:
      "Création de compte, identification de la société, validation par notre équipe. Un seul KYC pour toutes vos offres futures.",
  },
  {
    n: "2",
    title: "Publiez votre offre",
    body:
      "Décrivez le poste, les compétences, les langues, le pays. Notre éditeur vous guide pour ne rien oublier (durée du contrat, logement, billet d'avion).",
  },
  {
    n: "3",
    title: "Recevez des profils notés",
    body:
      "Chaque candidat est noté de 0 à 100 selon vos critères. Le PII (nom, photo, adresse) est masqué tant que vous n'avez pas engagé la présélection.",
  },
  {
    n: "4",
    title: "Présélection et entretiens",
    body:
      "Marquez les profils qui vous intéressent. Les coordonnées se débloquent. Vous pouvez organiser des entretiens vidéo directement dans la plateforme.",
  },
  {
    n: "5",
    title: "Offre et contrat",
    body:
      "Émettez une offre formelle dans la plateforme. Le candidat signe en ligne. Notre équipe vous assiste sur le contrat local.",
  },
  {
    n: "6",
    title: "Embarquement",
    body:
      "Visa, billet, logement : suivi conjoint avec le candidat jusqu'au premier jour. Vous recevez un point d'étape à 30 et 90 jours après l'embauche.",
  },
];

export default function GuideEntreprisePage() {
  return (
    <PublicShell active={null}>
      <Section padY={80}>
        <SectionHeader
          eyebrow="Guide entreprise"
          title="Recruter en confiance"
          subtitle="Le parcours complet, de la création de compte à l'embarquement."
          align="left"
        />
        <Stack gap={16} style={{ marginTop: 32, maxWidth: 760 }}>
          {STEPS.map((s) => (
            <Card key={s.n} padding={28} surface={1}>
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
                  {s.n}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 className="mg-heading-sm" style={{ margin: "4px 0 8px" }}>
                    {s.title}
                  </h3>
                  <p className="mg-body" style={{ margin: 0, color: "hsl(var(--muted-foreground))" }}>
                    {s.body}
                  </p>
                </div>
              </Stack>
            </Card>
          ))}
          <div style={{ marginTop: 16 }}>
            <Link href="/sign-up" style={{ textDecoration: "none" }}>
              <Button>Publier une offre</Button>
            </Link>
          </div>
        </Stack>
      </Section>
    </PublicShell>
  );
}
