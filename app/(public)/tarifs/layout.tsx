import type { Metadata } from "next";

// Sibling-layout metadata trick: page.tsx is "use client" and can't export
// metadata, so the per-page title lives here. Next.js merges this with the
// root metadata in app/layout.tsx.
export const metadata: Metadata = {
  title: "MG·Work — Tarifs",
  description:
    "Tarifs MG·Work pour les entreprises qui recrutent à Maurice, La Réunion et aux Seychelles. Toujours gratuit pour les candidats.",
};

export default function TarifsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
