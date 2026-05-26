import { getTranslations } from "next-intl/server";
import {
  PublicShell,
  Section,
  SectionHeader,
  Card,
  Stack,
  Icon,
  type IconName,
} from "@/components/mg";

export const metadata = {
  title: "MG·Work — Nous contacter",
  description: "Comment joindre l'équipe MG·Work.",
};

const CHANNEL_KEYS = ["general", "privacy", "enterprise", "offices"] as const;
type ChannelKey = (typeof CHANNEL_KEYS)[number];

const CHANNEL_META: Record<
  ChannelKey,
  { icon: IconName; mailto: boolean }
> = {
  general: { icon: "mail", mailto: true },
  privacy: { icon: "shield-check", mailto: true },
  enterprise: { icon: "building-2", mailto: true },
  offices: { icon: "map-pin", mailto: false },
};

export default async function ContactPage() {
  const t = await getTranslations("marketing");

  return (
    <PublicShell active={null}>
      <Section padY={80}>
        <SectionHeader
          title={t("contact.title")}
          subtitle={t("contact.subtitle")}
          align="left"
        />
        <Stack gap={16} style={{ marginTop: 32, maxWidth: 640 }}>
          {CHANNEL_KEYS.map((key) => {
            const meta = CHANNEL_META[key];
            const title = t(`contact.channels.${key}.title`);
            const body = t(`contact.channels.${key}.body`);
            const href = meta.mailto ? `mailto:${body}` : null;
            return (
              <Card key={key} padding={24} surface={1}>
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
                    <Icon name={meta.icon} size={20} aria-hidden />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="mg-micro"
                      style={{ color: "hsl(var(--muted-foreground))", marginBottom: 2 }}
                    >
                      {title}
                    </div>
                    {href ? (
                      <a
                        href={href}
                        className="mg-body"
                        style={{
                          color: "hsl(var(--foreground))",
                          textDecoration: "none",
                          wordBreak: "break-word",
                        }}
                      >
                        {body}
                      </a>
                    ) : (
                      <div className="mg-body" style={{ wordBreak: "break-word" }}>
                        {body}
                      </div>
                    )}
                  </div>
                </Stack>
              </Card>
            );
          })}
        </Stack>
      </Section>
    </PublicShell>
  );
}
