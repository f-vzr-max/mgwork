import { PublicShell, Section, SectionHeader, Card, Stack } from "@/components/mg";

export const metadata = {
  title: "MG·Work — Mentions légales",
  description:
    "Mentions légales MG·Work SARL — éditeur, hébergeur, directeur de la publication.",
};

export default function MentionsLegalesPage() {
  return (
    <PublicShell active={null}>
      <Section padY={80}>
        <SectionHeader title="Mentions légales" align="left" />
        <Stack gap={24} style={{ marginTop: 32, maxWidth: 720 }}>
          <Card padding={32} surface={1}>
            <h2 className="mg-heading-md" style={{ marginTop: 0 }}>
              Éditeur du site
            </h2>
            <p className="mg-body">
              MG·Work SARL, société à responsabilité limitée de droit mauricien,
              immatriculée au Registre de Commerce de Maurice. Siège social :
              Port-Louis, Maurice. Bureau opérationnel : Antananarivo, Madagascar.
            </p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-heading-md" style={{ marginTop: 0 }}>
              Directeur de la publication
            </h2>
            <p className="mg-body">
              Le directeur de la publication est le gérant de MG·Work SARL.
              Toute demande peut être adressée à l&apos;adresse de contact ci-dessous.
            </p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-heading-md" style={{ marginTop: 0 }}>
              Hébergement
            </h2>
            <p className="mg-body">
              Le site est hébergé par Vercel Inc., 340 S Lemon Ave #4133,
              Walnut CA 91789, USA. La base de données est hébergée par Supabase
              dans la région océan Indien.
            </p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-heading-md" style={{ marginTop: 0 }}>
              Contact
            </h2>
            <p className="mg-body">
              Pour toute question juridique : contact@mgwork.io. Pour la
              protection des données : voir notre{" "}
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
