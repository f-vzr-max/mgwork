import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { PublicHeader } from "@/components/mg";

export const metadata: Metadata = {
  title: "AsanaoConnect — Se connecter",
  description: "Connectez-vous à votre compte AsanaoConnect.",
};

// Wrap the Clerk-hosted sign-in widget in the MG public shell so it shares
// the marketing chrome (header, surface colors). No active nav link — sign-in
// isn't one of the main marketing sections.
export default function SignInPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "hsl(var(--surface-2))",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <PublicHeader />
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 16px",
        }}
      >
        <div className="w-full max-w-[440px]">
          <SignIn />
        </div>
      </main>
    </div>
  );
}
