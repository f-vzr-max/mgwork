"use client";

// CountryGuide — short, language-aware integration guide for new arrivals.
//
// Static content for v1; the "Ask AsanaoConnect agent" button deep-links into the
// candidate chat with a prefilled question so the existing M6 chat answers
// real questions on demand.

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export type GuideLang = "FR" | "EN" | "MG";

export type CountryGuideProps = {
  initialLang?: GuideLang;
};

type Section = { title: string; body: string };

const CONTENT: Record<GuideLang, Section[]> = {
  FR: [
    {
      title: "Maurice en bref",
      body:
        "L'île Maurice est une démocratie multiculturelle de l'océan Indien. Le créole mauricien sert de lingua franca, le français domine dans les médias et l'administration, et l'anglais est la langue officielle des tribunaux et des affaires. La monnaie est la roupie mauricienne (MUR).",
    },
    {
      title: "Vie quotidienne",
      body:
        "Le coût de la vie est plus élevé qu'à Madagascar mais reste abordable hors zones touristiques. Les supermarchés, les transports et la santé sont bien développés. Internet 4G/5G couvre la quasi-totalité du pays. Conduite à gauche.",
    },
    {
      title: "Communauté malgache",
      body:
        "Une communauté malgache importante vit principalement à Port-Louis, Curepipe et Quatre-Bornes. Plusieurs associations organisent des événements culturels, des messes et des activités sportives. AsanaoConnect peut vous mettre en relation avec ces réseaux dès votre arrivée.",
    },
    {
      title: "Démarches à l'arrivée",
      body:
        "Présentez-vous à votre employeur avec votre passeport et votre permis de travail. L'ouverture d'un compte bancaire local prend généralement 5 à 10 jours ouvrés. Conservez les copies numériques de tous vos documents — elles sont accessibles depuis votre portefeuille AsanaoConnect.",
    },
  ],
  EN: [
    {
      title: "Mauritius at a glance",
      body:
        "Mauritius is a multicultural democracy in the Indian Ocean. Mauritian Creole is the lingua franca, French dominates the media and administration, and English is the official language of courts and business. The currency is the Mauritian Rupee (MUR).",
    },
    {
      title: "Daily life",
      body:
        "The cost of living is higher than in Madagascar but remains affordable outside tourist areas. Supermarkets, transport, and healthcare are well-developed. 4G/5G internet covers almost the whole island. Drive on the left.",
    },
    {
      title: "Malagasy community",
      body:
        "A sizeable Malagasy community lives mainly in Port-Louis, Curepipe, and Quatre-Bornes. Associations run cultural events, religious services, and sports. AsanaoConnect can connect you to these networks on arrival.",
    },
    {
      title: "On-arrival steps",
      body:
        "Report to your employer with your passport and work permit. Opening a local bank account usually takes 5–10 business days. Keep digital copies of every document — they are available in your AsanaoConnect wallet.",
    },
  ],
  MG: [
    {
      title: "Maorisy mafohifohy",
      body:
        "Firenena demokratika maro karazana any amin'ny Ranomasimbe Indianina i Maorisy. Ny teny kreoly maoriseanina no fitenim-pifaneraserana, ny frantsay no manjaka any amin'ny haino aman-jery sy ny fitantanana, ary ny anglisy no teny ofisialy any amin'ny fitsarana sy ny raharaham-barotra. Ny vola ampiasaina dia ny Roupie Maoriseanina (MUR).",
    },
    {
      title: "Fiainana andavanandro",
      body:
        "Lafo kokoa noho any Madagasikara ny fiainana fa azo zakaina ihany raha tsy any amin'ny faritra fizahantany. Mivelatra tsara ny fivarotana, ny fitaterana ary ny fahasalamana. Ny aterineto 4G/5G dia mahasahana ny ankamaroan'ny nosy. Atao havia ny fitondrana fiara.",
    },
    {
      title: "Vondrom-piarahamonina malagasy",
      body:
        "Vondrona malagasy lehibe no monina indrindra any Port-Louis, Curepipe ary Quatre-Bornes. Misy fikambanana mikarakara hetsika ara-kolontsaina, fanompoam-pivavahana ary fanatanjahantena. Afaka mampifandray anao amin'izany rehetra izany ny AsanaoConnect.",
    },
    {
      title: "Asa atao rehefa tonga",
      body:
        "Misehoa amin'ny mpampiasa anao miaraka amin'ny pasipaorona sy fahazoan-dàlana hiasa. Maharitra 5 ka hatramin'ny 10 andro miasa ny famoronana kaonty banky. Tehirizo ny dika mitovy nomerika rehetra — azo jerena ao amin'ny vata AsanaoConnect.",
    },
  ],
};

const ASK_LABELS: Record<GuideLang, string> = {
  FR: "Demander à l'agent AsanaoConnect",
  EN: "Ask AsanaoConnect agent",
  MG: "Anontanio ny mpiandraikitra AsanaoConnect",
};

const PREFILL_QUESTION: Record<GuideLang, string> = {
  FR: "Bonjour, j'arrive bientôt à Maurice. Pouvez-vous m'aider à préparer mes premiers jours ?",
  EN: "Hi, I'm arriving in Mauritius soon. Can you help me prepare my first days?",
  MG: "Salama, ho tonga any Maorisy aho tsy ho ela. Afaka manampy ahy hanomana ny andro voalohany ve ianao?",
};

export function CountryGuide({ initialLang = "FR" }: CountryGuideProps) {
  const [lang, setLang] = React.useState<GuideLang>(initialLang);
  const sections = CONTENT[lang];
  const askHref = `/candidate?openChat=1&prefill=${encodeURIComponent(PREFILL_QUESTION[lang].slice(0, 500))}`;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {(["FR", "EN", "MG"] as GuideLang[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={
              lang === l
                ? "rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                : "rounded-md border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
            }
          >
            {l}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {sections.map((s) => (
          <article key={s.title} className="rounded-md border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold">{s.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </article>
        ))}
      </div>

      <div>
        <Button asChild>
          <Link href={askHref}>{ASK_LABELS[lang]}</Link>
        </Button>
      </div>
    </div>
  );
}
