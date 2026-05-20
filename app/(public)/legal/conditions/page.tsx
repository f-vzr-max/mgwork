import { PublicShell, Section, SectionHeader, Card, Stack } from "@/components/mg";

export const metadata = {
  title: "MG·Work — Conditions d'utilisation",
  description: "Conditions générales d'utilisation de la plateforme MG·Work.",
};

export default function ConditionsPage() {
  return (
    <PublicShell active={null}>
      <Section padY={80}>
        <SectionHeader title="Conditions d'utilisation" align="left" />
        <Stack gap={24} style={{ marginTop: 32, maxWidth: 720 }}>
          <Card padding={32} surface={1}>
            <h2 className="mg-heading-md" style={{ marginTop: 0 }}>
              Objet
            </h2>
            <p className="mg-body">
              Les présentes conditions régissent l&apos;utilisation de la
              plateforme MG·Work par les candidats à la mobilité du travail et
              par les entreprises qui recrutent dans la zone océan Indien.
            </p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-heading-md" style={{ marginTop: 0 }}>
              Gratuité pour les candidats
            </h2>
            <p className="mg-body">
              La création de profil, le matching et l&apos;accompagnement
              administratif sont gratuits pour les candidats. Notre revenu vient
              exclusivement des entreprises (voir{" "}
              <a href="/tarifs" className="underline">
                Tarifs
              </a>
              ).
            </p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-heading-md" style={{ marginTop: 0 }}>
              Engagements des entreprises
            </h2>
            <p className="mg-body">
              Validation KYC obligatoire avant publication d&apos;une offre.
              Respect des conditions de travail légales du pays
              d&apos;embauche. Confidentialité des données candidat partagées
              avant présélection.
            </p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-heading-md" style={{ marginTop: 0 }}>
              Résiliation
            </h2>
            <p className="mg-body">
              Vous pouvez supprimer votre compte à tout moment depuis
              l&apos;interface. La suppression entraîne l&apos;effacement de vos
              données dans les conditions prévues par notre{" "}
              <a href="/legal/confidentialite" className="underline">
                politique de confidentialité
              </a>
              .
            </p>
          </Card>
        </Stack>
      </Section>
    </PublicShell>
  );
}
