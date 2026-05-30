import { getTranslations } from "next-intl/server";

// Sibling-layout metadata trick: page.tsx is "use client" and can't export
// metadata, so the per-page title lives here. Next.js merges this with the
// root metadata in app/layout.tsx.
export async function generateMetadata() {
  const t = await getTranslations("marketing");
  return {
    title: t("tarifs.metaTitle"),
    description: t("tarifs.metaDescription"),
  };
}

export default function TarifsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
