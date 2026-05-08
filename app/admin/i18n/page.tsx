// Admin i18n / translations page — view & edit Translation rows. Filterable
// by language. Data is pulled at request time so edits show up after save.

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
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
        title="Translations"
        description="Override or extend the JSON dictionaries via DB. DB values take priority at lookup time."
      />
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
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
          </CardContent>
        </Card>
      </div>
    </>
  );
}
