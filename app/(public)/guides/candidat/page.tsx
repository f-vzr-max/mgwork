import { PublicShell, Section, SectionHeader, Card, Stack, Button } from "@/components/mg";
import Link from "next/link";

export const metadata = {
  title: "MG·Work — Guide candidat",
  description:
    "Le parcours candidat MG·Work pas à pas : profil, matching, départ.",
};

const STEPS = [
  {
    n: "1",
    title: "Créez votre profil (10 min)",
    body:
      "Identité, expériences, langues parlées, secteur recherché, pays souhaités. Vous pouvez sauvegarder en cours et reprendre plus tard.",
  },
  {
    n: "2",
    title: "Validez vos pièces (24 à 48 h)",
    body:
      "Notre équipe vérifie votre identité et vos diplômes. Vous recevez un email dès que c'est validé.",
  },
  {
    n: "3",
    title: "Recevez des matchs",
    body:
      "Notre moteur croise votre profil avec les offres ouvertes. Chaque match est noté de 0 à 100 et accompagné d'une explication.",
  },
  {
    n: "4",
    title: "Postulez en un clic",
    body:
      "Vos données ne sont partagées avec l'entreprise qu'après votre accord explicite. Tant que vous n'avez pas postulé, votre nom reste masqué.",
  },
  {
    n: "5",
    title: "Entretien et offre",
    body:
      "L'entreprise organise un ou deux entretiens vidéo. Si accord, vous recevez une offre formelle dans la plateforme.",
  },
  {
    n: "6",
    title: "Documents, visa, logement",
    body:
      "Un conseiller vous accompagne pour le visa, le contrat et le logement. Premier mois sur place suivi de près.",
  },
];

export default function GuideCandidatPage() {
  return (
    <PublicShell active={null}>
      <Section padY={80}>
        <SectionHeader
          eyebrow="Guide candidat"
          title="De l'inscription au départ"
          subtitle="Tout ce qu'il faut savoir avant de postuler."
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
              <Button>Créer mon profil</Button>
            </Link>
          </div>
        </Stack>
      </Section>
    </PublicShell>
  );
}
