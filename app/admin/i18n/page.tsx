// Admin i18n / translations page — view & edit Translation rows. Filterable
// by language. Business logic preserved; chrome restyled with MG primitives.

import { PageHeader, Card } from "@/components/mg";
import { prisma } from "@/lib/prisma";
import { TranslationsManager } from "@/components/admin/TranslationsManager";
import type { Language } from "@prisma/client";

export const dynamic = "force-dynamic";

const LANGS: Language[] = ["FR", "EN", "MG"];

export default async function AdminI18nPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const langParam = Array.isArray(searchParams.lang)
    ? searchParams.lang[0]
    : searchParams.lang;
  const selectedLang: Language = LANGS.includes(langParam as Language)
    ? (langParam as Language)
    : "FR";

  const translations = await prisma.translation.findMany({
    where: { lang: selectedLang },
    orderBy: { key: "asc" },
    take: 1000,
  });

  return (
    <>
      <PageHeader
        title="Traductions"
        subtitle="Surcharger ou compléter les dictionnaires JSON via la base. La valeur en base prime à la lecture."
      />
      <div style={{ padding: "0 32px 32px" }}>
        <Card padding={24}>
          <TranslationsManager
            selectedLang={selectedLang}
            languages={LANGS}
            initial={translations.map((t) => ({
              id: t.id,
              lang: t.lang,
              key: t.key,
              value: t.value,
            }))}
          />
        </Card>
      </div>
    </>
  );
}
