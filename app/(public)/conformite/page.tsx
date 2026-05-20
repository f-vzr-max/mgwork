import * as React from "react";
import {
  Badge,
  Button,
  Card,
  Icon,
  PublicShell,
  Section,
  SectionHeader,
  Stack,
  type IconName,
} from "@/components/mg";
import { FaqItem } from "../_components";

export const metadata = {
  title: "MG·Work — Conformité & sécurité des données",
  description:
    "Conformité Data Protection Act Mauritius 2017, PII masqué par défaut, hébergement régional. La conformité par construction.",
};

const PILLARS = [
  {
    icon: "shield-check" as const,
    title: "Minimisation des données",
    body:
      "Nous ne collectons que ce qui est strictement nécessaire au matching et à l'embauche. Les pièces sensibles (passeport, médical) sont supprimées 90 jours après le recrutement.",
  },
  {
    icon: "eye" as const,
    title: "PII masqué par défaut",
    body:
      "Le nom, l'adresse et la photo des candidats sont masqués pour les entreprises tant qu'une présélection n'a pas été engagée. Vous ne voyez que ce qui sert à décider.",
  },
  {
    icon: "file-text" as const,
    title: "Audit log complet",
    body:
      "Chaque accès aux données candidat est journalisé : qui, quand, pourquoi. Le candidat peut consulter son journal d'accès depuis son compte.",
  },
  {
    icon: "globe" as const,
    title: "Hébergement régional",
    body:
      "Toutes les données sont stockées à Port-Louis et répliquées à Saint-Denis. Aucune donnée ne quitte l'océan Indien sans demande explicite.",
  },
];

type LifecycleTone = "info" | "warning" | "success" | "neutral";

const LIFECYCLE: { step: string; body: string; tone: LifecycleTone; icon: IconName }[] = [
  {
    step: "Collecte",
    body: "Le candidat saisit ses données. Consentement explicite par cas d'usage.",
    tone: "info",
    icon: "upload",
  },
  {
    step: "Vérification",
    body: "Identité et diplômes contrôlés par notre équipe. Documents chiffrés au repos.",
    tone: "info",
    icon: "shield-check",
  },
  {
    step: "Matching",
    body: "Le moteur calcule un score sur des critères pondérés et auditables.",
    tone: "info",
    icon: "sparkles",
  },
  {
    step: "Présélection",
    body: "Le PII est révélé à l'entreprise après acceptation de la présélection.",
    tone: "warning",
    icon: "eye",
  },
  {
    step: "Embauche",
    body: "Contrat signé. Les pièces sensibles sont supprimées sous 90 jours.",
    tone: "success",
    icon: "check-circle-2",
  },
  {
    step: "Archivage",
    body: "Données minimales conservées 5 ans pour conformité fiscale, puis supprimées.",
    tone: "neutral",
    icon: "file-text",
  },
];

function toneToBg(tone: LifecycleTone): string {
  switch (tone) {
    case "info":
      return "var(--info-bg)";
    case "warning":
      return "var(--warning-bg)";
    case "success":
      return "var(--success-bg)";
    case "neutral":
      return "var(--neutral-bg)";
  }
}

function toneToFg(tone: LifecycleTone): string {
  switch (tone) {
    case "info":
      return "hsl(var(--info))";
    case "warning":
      return "hsl(var(--warning))";
    case "success":
      return "hsl(var(--success))";
    case "neutral":
      return "hsl(var(--foreground))";
  }
}

const RIGHTS = [
  "Accès à mes données",
  "Rectification",
  "Suppression",
  "Portabilité",
  "Opposition",
];

export default function ConformitePage() {
  return (
    <PublicShell active="conformite">
      {/* Hero */}
      <div
        style={{
          background:
            "linear-gradient(180deg, rgba(19,115,176,0.06) 0%, hsl(var(--background)) 100%)",
          padding: "72px 32px 56px",
        }}
      >
        <div style={{ maxWidth: 920, margin: "0 auto", textAlign: "center" }}>
          <Badge tone="info" size="md" icon="shield-check" style={{ marginBottom: 20 }}>
            Conformité régionale
          </Badge>
          <h1
            className="mg-display"
            style={{ margin: 0, textWrap: "balance" as React.CSSProperties["textWrap"] }}
          >
            La conformité,
            <br />
            par <span style={{ color: "hsl(var(--info))" }}>construction</span>.
          </h1>
          <p
            className="mg-body-lg"
            style={{
              margin: "20px auto 0",
              color: "hsl(var(--muted-foreground))",
              maxWidth: 640,
            }}
          >
            MG·Work est conforme au Data Protection Act Mauritius 2017. Chaque flux de données —
            candidat, entreprise, paiement — est tracé, chiffré et auditable.
          </p>
          <Stack dir="row" gap={8} justify="center" style={{ marginTop: 28 }} wrap>
            <Badge tone="success" icon="check-circle-2">
              DPA Mauritius 2017
            </Badge>
            <Badge tone="success" icon="check-circle-2">
              ISO 27001 (en cours)
            </Badge>
            <Badge tone="success" icon="check-circle-2">
              RGPD-aligné
            </Badge>
          </Stack>
        </div>
      </div>

      {/* Pillars */}
      <Section padY={96}>
        <SectionHeader
          eyebrow="Nos 4 engagements"
          title="Ce qui protège candidats et entreprises"
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
          {PILLARS.map((p) => (
            <Card key={p.title} padding={28}>
              <Stack dir="row" gap={20} align="flex-start">
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    background: "var(--info-bg)",
                    color: "hsl(var(--info))",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name={p.icon} size={22} />
                </div>
                <div>
                  <h3 className="mg-h3" style={{ margin: 0 }}>
                    {p.title}
                  </h3>
                  <p
                    className="mg-body"
                    style={{ color: "hsl(var(--muted-foreground))", margin: "8px 0 0" }}
                  >
                    {p.body}
                  </p>
                </div>
              </Stack>
            </Card>
          ))}
        </div>
      </Section>

      {/* Lifecycle */}
      <Section padY={96} surface={2}>
        <SectionHeader
          eyebrow="Cycle de vie des données"
          title="Ce qui se passe, étape par étape"
        />
        <Card padding={0}>
          {LIFECYCLE.map((s, i) => (
            <div
              key={s.step}
              style={{
                display: "grid",
                gridTemplateColumns: "40px 180px 1fr",
                gap: 20,
                padding: "20px 28px",
                alignItems: "center",
                borderTop: i === 0 ? 0 : "1px solid hsl(var(--border))",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9999,
                  background: toneToBg(s.tone),
                  color: toneToFg(s.tone),
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </div>
              <Stack dir="row" gap={10} align="center">
                <Icon
                  name={s.icon}
                  size={16}
                  style={{ color: "hsl(var(--muted-foreground))" }}
                />
                <span className="mg-body" style={{ fontWeight: 600 }}>
                  {s.step}
                </span>
              </Stack>
              <span
                className="mg-body-sm"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                {s.body}
              </span>
            </div>
          ))}
        </Card>
      </Section>

      {/* DPO contact */}
      <Section padY={96}>
        <Card padding={48} style={{ background: "hsl(var(--surface-2))" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr",
              gap: 48,
              alignItems: "center",
            }}
          >
            <div>
              <Badge tone="primary" icon="users" style={{ marginBottom: 12 }}>
                Délégué à la protection des données
              </Badge>
              <h3 className="mg-h2" style={{ margin: 0 }}>
                Une question, un signalement ?
              </h3>
              <p
                className="mg-body-lg"
                style={{
                  color: "hsl(var(--muted-foreground))",
                  margin: "12px 0 24px",
                  maxWidth: 480,
                }}
              >
                Notre DPO répond à toute demande d&apos;accès, de rectification ou de suppression sous
                72 heures ouvrées.
              </p>
              <Stack dir="row" gap={12}>
                <Button iconLeft="mail">dpo@mg-work.com</Button>
                <Button variant="outline">Politique de confidentialité</Button>
              </Stack>
            </div>
            <Card padding={24}>
              <div
                className="mg-micro"
                style={{ color: "hsl(var(--muted-foreground))", marginBottom: 12 }}
              >
                Vos droits
              </div>
              <Stack gap={8}>
                {RIGHTS.map((r) => (
                  <Stack key={r} dir="row" gap={10} align="center">
                    <Icon
                      name="check-circle-2"
                      size={14}
                      style={{ color: "hsl(var(--success))" }}
                    />
                    <span className="mg-body-sm">{r}</span>
                  </Stack>
                ))}
              </Stack>
            </Card>
          </div>
        </Card>
      </Section>

      {/* FAQ */}
      <Section padY={96} surface={2}>
        <SectionHeader eyebrow="FAQ" title="Conformité & sécurité" align="center" />
        <div style={{ maxWidth: 800, margin: "0 auto", display: "grid", gap: 12 }}>
          <FaqItem
            open
            q="Où sont stockées mes données ?"
            a="À Port-Louis (Maurice), avec réplication à Saint-Denis (La Réunion). Aucune donnée ne quitte la région océan Indien sans demande explicite et tracée."
          />
          <FaqItem q="Combien de temps gardez-vous mes documents ?" />
          <FaqItem q="Qui peut voir mon profil ?" />
          <FaqItem q="Comment supprimer mon compte ?" />
        </div>
      </Section>
    </PublicShell>
  );
}
