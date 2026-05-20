import { PublicShell, Section, SectionHeader, Card, Stack } from "@/components/mg";

export const metadata = {
  title: "MG·Work — Politique cookies",
  description: "Quels cookies MG·Work utilise et pourquoi.",
};

export default function CookiesPage() {
  return (
    <PublicShell active={null}>
      <Section padY={80}>
        <SectionHeader title="Politique cookies" align="left" />
        <Stack gap={24} style={{ marginTop: 32, maxWidth: 720 }}>
          <Card padding={32} surface={1}>
            <h2 className="mg-heading-md" style={{ marginTop: 0 }}>
              Cookies fonctionnels
            </h2>
            <p className="mg-body">
              <strong>mgwork_lang</strong> — mémorise votre choix de langue
              (FR/EN). Durée 6 mois.
              <br />
              <strong>__session</strong>, <strong>__client_uat</strong> —
              cookies de session émis par Clerk pour vous garder connecté(e).
              Durée de la session.
              <br />
              <strong>theme</strong> — mémorise votre choix de thème
              (clair/sombre). Durée 1 an.
            </p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-heading-md" style={{ marginTop: 0 }}>
              Cookies tiers
            </h2>
            <p className="mg-body">
              Aucun cookie de tracking publicitaire n&apos;est posé. Le bouton
              Clerk de connexion peut poser des cookies depuis le domaine
              clerk.accounts.dev (authentification uniquement).
            </p>
          </Card>
          <Card padding={32} surface={1}>
            <h2 className="mg-heading-md" style={{ marginTop: 0 }}>
              Vos choix
            </h2>
            <p className="mg-body">
              Tous les cookies listés ici sont nécessaires au fonctionnement de
              la plateforme — pas de cookies optionnels à refuser. Vous pouvez
              les supprimer depuis votre navigateur ; vous serez alors
              déconnecté(e).
            </p>
          </Card>
        </Stack>
      </Section>
    </PublicShell>
  );
}
