import type { Metadata } from "next";

// page.tsx is "use client" (uses useState for the role-choice step), so
// metadata lives on this sibling layout instead.
export const metadata: Metadata = {
  title: "MG·Work — S'inscrire",
  description: "Créez votre compte MG·Work — candidat ou entreprise.",
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
