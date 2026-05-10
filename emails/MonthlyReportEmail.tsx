import * as React from "react";
import { Heading, Section, Text } from "@react-email/components";
import { EmailLayout, pick, type EmailLang } from "./_layout";

export type MonthlyReportSummary = {
  period: string; // e.g. "April 2026"
  activeOffers: number;
  applications: number;
  interviewsHeld: number;
  deployments: number;
};

export type MonthlyReportEmailProps = {
  enterpriseName: string;
  summary: MonthlyReportSummary;
  lang: EmailLang;
};

const TEXTS = {
  FR: {
    subject: (period: string) => `Rapport mensuel — ${period}`,
    preview: (period: string) => `Récapitulatif de votre activité ${period}.`,
    greeting: (n: string) => `Bonjour ${n},`,
    body: (period: string) =>
      `Voici le récapitulatif de votre activité sur MG Work pour ${period}.`,
    rows: {
      activeOffers: "Offres actives",
      applications: "Candidatures reçues",
      interviewsHeld: "Entretiens réalisés",
      deployments: "Déploiements",
    },
    closing: "Notre équipe reste à votre disposition pour toute question.",
  },
  EN: {
    subject: (period: string) => `Monthly report — ${period}`,
    preview: (period: string) => `Recap of your ${period} activity.`,
    greeting: (n: string) => `Hello ${n},`,
    body: (period: string) =>
      `Here is the recap of your activity on MG Work for ${period}.`,
    rows: {
      activeOffers: "Active offers",
      applications: "Applications received",
      interviewsHeld: "Interviews held",
      deployments: "Deployments",
    },
    closing: "Our team remains at your disposal for any questions.",
  },
  MG: {
    subject: (period: string) => `Tatitra isam-bolana — ${period}`,
    preview: (period: string) => `Famintinana ny asa nataonao tamin'ny ${period}.`,
    greeting: (n: string) => `Salama ${n},`,
    body: (period: string) =>
      `Ity ny famintinana ny asanao tao amin'ny MG Work amin'ny ${period}.`,
    rows: {
      activeOffers: "Tolo-pahataovana mavitrika",
      applications: "Fangatahana azo",
      interviewsHeld: "Resadresaka natao",
      deployments: "Fametrahana",
    },
    closing: "Vonona hanampy anao foana ny ekipanay.",
  },
} as const;

export const MonthlyReportEmailSubjects = (lang: EmailLang, period: string): string =>
  pick(TEXTS, lang).subject(period);

export default function MonthlyReportEmail({
  enterpriseName,
  summary,
  lang,
}: MonthlyReportEmailProps): React.ReactElement {
  const t = pick(TEXTS, lang);
  return (
    <EmailLayout preview={t.preview(summary.period)} lang={lang}>
      <Heading className="m-0 text-xl text-gray-900">{t.greeting(enterpriseName)}</Heading>
      <Text className="text-gray-700">{t.body(summary.period)}</Text>
      <Section className="rounded-md border border-gray-200 bg-gray-50 p-4">
        <Row label={t.rows.activeOffers} value={summary.activeOffers} />
        <Row label={t.rows.applications} value={summary.applications} />
        <Row label={t.rows.interviewsHeld} value={summary.interviewsHeld} />
        <Row label={t.rows.deployments} value={summary.deployments} />
      </Section>
      <Text className="text-gray-700">{t.closing}</Text>
    </EmailLayout>
  );
}

function Row({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <Text className="m-0 flex justify-between border-b border-gray-100 py-1 text-sm text-gray-700 last:border-b-0">
      <span>{label}</span>
      <strong className="text-gray-900">{value}</strong>
    </Text>
  );
}
