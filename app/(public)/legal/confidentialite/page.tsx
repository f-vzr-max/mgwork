import { PublicShell, Section, SectionHeader, Card, Stack, Badge } from "@/components/mg";

export const metadata = {
  title: "MG·Work — Confidentialité",
  description:
    "Politique de confidentialité MG·Work, conforme Data Protection Act Mauritius 2017.",
};

export default function ConfidentialitePage() {
  return (
    <PublicShell active={null}>
      <Section padY={80}>
        <SectionHeader title="Politique de confidentialité" align="left" />
        <Stack gap={24} style={{ marginTop: 32, maxWidth: 720 }}>
          <Stack dir="row" gap={8} wrap>
            <Badge tone="success" icon="shield-check">
              DPA Mauritius 2017
            </Badge>
            <Badge tone="neutral" icon="globe">
              Hébergement océan Indien
            </Badge>
          </Stack>
          <Card padding={32} surface={1}>
            <h2 className="mg-heading-md" style={{ marginTop: 0 }}>
              Données collectées
            </h2>
            <p className="mg-body">
              Nous collectons uniquement les données nécessaires au matching et
              à l&apos;embauche : identité, parcours professionnel, langues,
              localisation souhaitée, pièces justificatives (passeport, diplômes)
              pour les candidats engagés dans un recrutement.
            </p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-heading-md" style={{ marginTop: 0 }}>
              Finalités du traitement
            </h2>
            <p className="mg-body">
              Mise en relation candidat-entreprise, vérification d&apos;identité,
              accompagnement administratif au départ (visa, contrat,
              logement), respect des obligations légales (notamment KYC pour les
              entreprises).
            </p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-heading-md" style={{ marginTop: 0 }}>
              Vos droits
            </h2>
            <p className="mg-body">
              Conformément au Data Protection Act Mauritius 2017, vous disposez
              d&apos;un droit d&apos;accès, de rectification, d&apos;effacement,
              d&apos;opposition et de portabilité de vos données. Adressez votre
              demande à privacy@mgwork.io ; nous répondons sous 30 jours.
            </p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-heading-md" style={{ marginTop: 0 }}>
              Conservation
            </h2>
            <p className="mg-body">
              Les pièces sensibles (passeport, médical) sont supprimées 90 jours
              après le recrutement. Les profils candidat inactifs sont anonymisés
              après 24 mois. Voir la page{" "}
              <a href="/conformite" className="underline">
                Conformité
              </a>{" "}
              pour le détail du cycle de vie des données.
            </p>
          </Card>
        </Stack>
      </Section>
    </PublicShell>
  );
}
