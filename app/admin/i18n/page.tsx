// Admin i18n / translations page — view & edit Translation rows. Filterable
// by language. Business logic preserved; chrome restyled with MG primitives.

import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("app.admin");

  return (
    <>
      <PageHeader
        title={t("i18n.title")}
        subtitle={t("i18n.subtitle")}
      />
      <div style={{ padding: "0 32px 32px" }}>
        <Card padding={24}>
          <TranslationsManager
            selectedLang={selectedLang}
            languages={LANGS}
            initial={translations.map((row) => ({
              id: row.id,
              lang: row.lang,
              key: row.key,
              value: row.value,
            }))}
          />
        </Card>
      </div>
    </>
  );
}
