import { SignIn } from "@clerk/nextjs";
import { PublicHeader, Card } from "@/components/mg";

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
          padding: "48px 24px",
        }}
      >
        <Card padding={32} surface={1} elevation={2}>
          <SignIn />
        </Card>
      </main>
    </div>
  );
}
