import * as React from "react";
import Link from "next/link";
import { Wordmark } from "./wordmark";
import { Badge } from "./badge";
import { Hairline } from "./hairline";
import { Stack } from "./stack";
import { Button } from "./button";
import { LanguageMenu } from "./language-menu";
import { ThemeToggle } from "./theme-toggle";

export type PublicNavKey = "candidats" | "entreprises" | "conformite" | "tarifs" | null;

interface NavLink {
  key: Exclude<PublicNavKey, null>;
  label: string;
  href: string;
}

const NAV_LINKS: NavLink[] = [
  { key: "candidats", label: "Candidats", href: "/candidats" },
  { key: "entreprises", label: "Entreprises", href: "/entreprises" },
  { key: "conformite", label: "Conformité", href: "/conformite" },
  { key: "tarifs", label: "Tarifs", href: "/tarifs" },
];

export interface PublicShellProps {
  active?: PublicNavKey;
  children: React.ReactNode;
}

export function PublicHeader({ active = null }: { active?: PublicNavKey }) {
  return (
    <header
      style={{
        borderBottom: "1px solid hsl(var(--border))",
        background: "hsl(var(--background))",
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        height: 100,
        padding: "10px 32px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1120,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 32,
        }}
      >
        <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
          <Wordmark size={32} />
        </Link>
        <nav style={{ display: "flex", gap: 28, alignItems: "center", flexShrink: 0 }} aria-label="Sections publiques">
          {NAV_LINKS.map((l) => {
            const isActive = l.key === active;
            return (
              <Link
                key={l.key}
                href={l.href}
                style={{
                  color: isActive ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                  fontWeight: isActive ? 600 : 500,
                  textDecoration: "none",
                  letterSpacing: "-0.01em",
                  fontSize: 15,
                  paddingBottom: 4,
                  borderBottom: isActive ? "2px solid hsl(var(--primary))" : "2px solid transparent",
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <Stack dir="row" gap={8} align="center" style={{ flexShrink: 0 }}>
          <LanguageMenu />
          <ThemeToggle />
          <Link href="/sign-in" style={{ textDecoration: "none" }}>
            <Button variant="ghost">Se connecter</Button>
          </Link>
          <Link href="/sign-up" style={{ textDecoration: "none" }}>
            <Button>S&apos;inscrire</Button>
          </Link>
        </Stack>
      </div>
    </header>
  );
}

export function PublicFooter() {
  const cols = [
    {
      title: "Produit",
      links: [
        { label: "Pour les candidats", href: "/candidats" },
        { label: "Pour les entreprises", href: "/entreprises" },
        { label: "Tarifs", href: "/tarifs" },
        { label: "Sécurité", href: "/conformite" },
        { label: "Status", href: "#" },
      ],
    },
    {
      title: "Ressources",
      links: [
        { label: "Guide candidat", href: "#" },
        { label: "Guide entreprise", href: "#" },
        { label: "Centre d'aide", href: "#" },
        { label: "Blog", href: "#" },
        { label: "Presse", href: "#" },
      ],
    },
    {
      title: "Entreprise",
      links: [
        { label: "À propos", href: "#" },
        { label: "Carrières", href: "#" },
        { label: "Partenaires", href: "#" },
        { label: "Nous contacter", href: "#" },
      ],
    },
    {
      title: "Légal",
      links: [
        { label: "Mentions légales", href: "#" },
        { label: "Confidentialité", href: "#" },
        { label: "Conditions d'utilisation", href: "#" },
        { label: "DPA Mauritius 2017", href: "/conformite" },
        { label: "Cookies", href: "#" },
      ],
    },
  ];
  const year = new Date().getFullYear();
  return (
    <footer style={{ background: "hsl(var(--surface-2))", borderTop: "1px solid hsl(var(--border))" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "56px 32px 32px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr repeat(4, 1fr)",
            gap: 48,
          }}
        >
          <div>
            <Wordmark size={26} />
            <p
              className="mg-body-sm"
              style={{ color: "hsl(var(--muted-foreground))", margin: "16px 0 20px", maxWidth: 280 }}
            >
              La plateforme sérieuse pour la mobilité du travail entre Madagascar et l&apos;océan Indien.
            </p>
            <Stack dir="row" gap={8} align="center" wrap>
              <Badge tone="success" icon="shield-check">
                DPA 2017
              </Badge>
              <Badge tone="neutral" icon="globe">
                FR · EN
              </Badge>
            </Stack>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div className="mg-micro" style={{ color: "hsl(var(--muted-foreground))", marginBottom: 14 }}>
                {c.title}
              </div>
              <Stack gap={10}>
                {c.links.map((l) => (
                  <Link
                    key={l.label}
                    href={l.href}
                    className="mg-body-sm"
                    style={{ color: "hsl(var(--foreground))", textDecoration: "none" }}
                  >
                    {l.label}
                  </Link>
                ))}
              </Stack>
            </div>
          ))}
        </div>
        <Hairline style={{ margin: "40px 0 20px" }} />
        <Stack dir="row" justify="space-between" align="center" gap={24} wrap>
          <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
            © {year} MG·Work SARL · Antananarivo, Madagascar · Port-Louis, Maurice
          </div>
          <Stack dir="row" gap={20}>
            <Link href="#" className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", textDecoration: "none" }}>
              Twitter
            </Link>
            <Link href="#" className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", textDecoration: "none" }}>
              LinkedIn
            </Link>
            <Link href="#" className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", textDecoration: "none" }}>
              YouTube
            </Link>
          </Stack>
        </Stack>
      </div>
    </footer>
  );
}

export function PublicShell({ active = null, children }: PublicShellProps) {
  return (
    <div
      className="mg-root"
      style={{
        width: "100%",
        minHeight: "100vh",
        background: "hsl(var(--background))",
        color: "hsl(var(--foreground))",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <PublicHeader active={active} />
      <main style={{ flex: 1 }}>{children}</main>
      <PublicFooter />
    </div>
  );
}

export default PublicShell;
