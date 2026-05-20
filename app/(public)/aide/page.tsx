import { PublicShell, Section, SectionHeader, Card, Stack, Button } from "@/components/mg";
import Link from "next/link";

export const metadata = {
  title: "MG·Work — Centre d'aide",
  description: "Questions fréquentes et contact pour les candidats et entreprises MG·Work.",
};

const FAQ = [
  {
    q: "MG·Work est-il payant pour les candidats ?",
    a: "Non. La création de profil, le matching et l'accompagnement administratif sont gratuits pour les candidats. Notre revenu vient des entreprises.",
  },
  {
    q: "Combien de temps faut-il pour trouver un poste ?",
    a: "Le délai moyen entre la création du profil et le départ effectif est de 14 jours à Maurice, 18 jours à La Réunion, 22 jours aux Seychelles. Cela dépend du secteur et de votre disponibilité.",
  },
  {
    q: "Comment vérifiez-vous l'identité des candidats ?",
    a: "Pièce d'identité officielle + diplômes scannés + vérification téléphonique. Notre équipe contrôle chaque profil avant qu'il devienne visible aux entreprises.",
  },
  {
    q: "Quels pays sont couverts ?",
    a: "Maurice, La Réunion et les Seychelles pour les destinations d'embauche. Madagascar pour le recrutement de candidats.",
  },
  {
    q: "Et après le départ ?",
    a: "Un conseiller vous suit pendant les 90 premiers jours. Vous avez accès à un canal de support dédié dans l'application.",
  },
  {
    q: "Comment supprimer mon compte ?",
    a: "Depuis votre profil, section Paramètres → Supprimer le compte. La suppression entraîne l'effacement de vos données dans les conditions prévues par notre politique de confidentialité.",
  },
];

export default function AidePage() {
  return (
    <PublicShell active={null}>
      <Section padY={80}>
        <SectionHeader
          title="Centre d'aide"
          subtitle="Les questions qu'on nous pose le plus souvent."
          align="left"
        />
        <Stack gap={12} style={{ marginTop: 32, maxWidth: 760 }}>
          {FAQ.map((item) => (
            <Card key={item.q} padding={24} surface={1}>
              <h3 className="mg-heading-sm" style={{ margin: "0 0 8px" }}>
                {item.q}
              </h3>
              <p
                className="mg-body"
                style={{ margin: 0, color: "hsl(var(--muted-foreground))" }}
              >
                {item.a}
              </p>
            </Card>
          ))}
          <Card padding={28} surface={2} style={{ marginTop: 16 }}>
            <Stack gap={12}>
              <h3 className="mg-heading-sm" style={{ margin: 0 }}>
                Pas trouvé votre réponse ?
              </h3>
              <p
                className="mg-body"
                style={{ margin: 0, color: "hsl(var(--muted-foreground))" }}
              >
                Écrivez-nous, on répond sous 24 h ouvrées.
              </p>
              <div>
                <Link href="/contact" style={{ textDecoration: "none" }}>
                  <Button>Nous contacter</Button>
                </Link>
              </div>
            </Stack>
          </Card>
        </Stack>
      </Section>
    </PublicShell>
  );
}
