import Link from "next/link";
import type { Metadata } from "next";
import { PublicShell, Card, Button, Stack, Icon } from "@/components/mg";

export const metadata: Metadata = {
  title: "AsanaoConnect — Page introuvable",
};

export default function NotFound() {
  return (
    <PublicShell active={null}>
      <div className="flex flex-1 items-center justify-center px-4 py-20">
        <Card className="w-full max-w-md">
          <Stack gap={20} align="center" style={{ padding: 32, textAlign: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: "hsl(var(--surface-2))",
                color: "hsl(var(--muted-foreground))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="alert-triangle" size={28} aria-hidden />
            </div>
            <h1 className="mg-display-sm" style={{ margin: 0 }}>
              Page introuvable
            </h1>
            <p
              className="mg-body"
              style={{ color: "hsl(var(--muted-foreground))", margin: 0, maxWidth: 360 }}
            >
              Cette page n&apos;existe pas ou a été déplacée. Revenez à l&apos;accueil pour
              continuer.
            </p>
            <Link href="/" style={{ textDecoration: "none" }}>
              <Button>Retour à l&apos;accueil</Button>
            </Link>
          </Stack>
        </Card>
      </div>
    </PublicShell>
  );
}
