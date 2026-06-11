import type { Metadata } from "next";

// page.tsx is "use client" (uses useState for the role-choice step), so
// metadata lives on this sibling layout instead.
export const metadata: Metadata = {
  title: "AsanaoConnect — S'inscrire",
  description: "Créez votre compte AsanaoConnect — candidat ou entreprise.",
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
