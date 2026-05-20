import { PublicShell, Section, SectionHeader, Card, Stack, Icon } from "@/components/mg";

export const metadata = {
  title: "MG·Work — Nous contacter",
  description: "Comment joindre l'équipe MG·Work.",
};

const CHANNELS = [
  {
    icon: "mail" as const,
    title: "Email général",
    body: "contact@mgwork.io",
    href: "mailto:contact@mgwork.io",
  },
  {
    icon: "shield-check" as const,
    title: "Protection des données",
    body: "privacy@mgwork.io",
    href: "mailto:privacy@mgwork.io",
  },
  {
    icon: "building-2" as const,
    title: "Partenariats entreprises",
    body: "entreprises@mgwork.io",
    href: "mailto:entreprises@mgwork.io",
  },
  {
    icon: "map-pin" as const,
    title: "Bureaux",
    body: "Port-Louis, Maurice · Antananarivo, Madagascar",
    href: null,
  },
];

export default function ContactPage() {
  return (
    <PublicShell active={null}>
      <Section padY={80}>
        <SectionHeader
          title="Nous contacter"
          subtitle="On vous répond sous 24 h ouvrées."
          align="left"
        />
        <Stack gap={16} style={{ marginTop: 32, maxWidth: 640 }}>
          {CHANNELS.map((c) => (
            <Card key={c.title} padding={24} surface={1}>
              <Stack dir="row" gap={16} align="center">
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: "hsl(var(--surface-2))",
                    color: "hsl(var(--primary))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name={c.icon} size={20} aria-hidden />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    className="mg-micro"
                    style={{ color: "hsl(var(--muted-foreground))", marginBottom: 2 }}
                  >
                    {c.title}
                  </div>
                  {c.href ? (
                    <a
                      href={c.href}
                      className="mg-body"
                      style={{
                        color: "hsl(var(--foreground))",
                        textDecoration: "none",
                      }}
                    >
                      {c.body}
                    </a>
                  ) : (
                    <div className="mg-body">{c.body}</div>
                  )}
                </div>
              </Stack>
            </Card>
          ))}
        </Stack>
      </Section>
    </PublicShell>
  );
}
