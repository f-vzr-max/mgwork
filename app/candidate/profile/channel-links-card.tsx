"use client";

// MG Work — "Connected channels" card (channels phase 0).
//
// Shows the candidate's linked WhatsApp/Messenger/Instagram identities, lets
// them generate a one-time link code (15-min expiry) with wa.me / m.me deep
// links, and unlink a channel. All calls go through /api/me/channel-links,
// which resolves the candidate from the Clerk session — this card never sends
// a candidate id. Rendered by app/candidate/profile/page.tsx.

import * as React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Card, Icon, Stack } from "@/components/mg";

type ChannelLink = {
  id: string;
  platform: string;
  status: string;
  linkedVia: string | null;
  linkedAt: string;
};

type ListResponse =
  | { ok: true; data: { channels: ChannelLink[] } }
  | { ok: false; error: { message: string } };

type IssueResponse =
  | {
      ok: true;
      data: {
        code: string;
        expiresAt: string;
        links: { whatsapp: string | null; messenger: string | null };
      };
    }
  | { ok: false; error: { message: string } };

type UnlinkResponse = { ok: true; data: { unlinked: boolean } } | { ok: false; error: { message: string } };

export default function ChannelLinksCard(): React.ReactElement {
  const t = useTranslations("channelLinks");
  const tc = useTranslations("common");

  const [channels, setChannels] = React.useState<ChannelLink[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [issuing, setIssuing] = React.useState(false);
  const [issued, setIssued] = React.useState<{
    code: string;
    expiresAt: string;
    links: { whatsapp: string | null; messenger: string | null };
  } | null>(null);
  const [unlinkingId, setUnlinkingId] = React.useState<string | null>(null);

  const fetchChannels = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/me/channel-links", { credentials: "same-origin" });
      const json = (await res.json().catch(() => null)) as ListResponse | null;
      if (!res.ok || !json || !json.ok) {
        setError(json && !json.ok ? json.error.message : t("error"));
        return;
      }
      setChannels(json.data.channels);
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    void fetchChannels();
  }, [fetchChannels]);

  async function issueCode() {
    setIssuing(true);
    setError(null);
    try {
      const res = await fetch("/api/me/channel-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({}),
      });
      const json = (await res.json().catch(() => null)) as IssueResponse | null;
      if (!res.ok || !json || !json.ok) {
        setError(json && !json.ok ? json.error.message : t("error"));
        return;
      }
      setIssued(json.data);
    } catch {
      setError(t("error"));
    } finally {
      setIssuing(false);
    }
  }

  async function unlink(id: string) {
    setUnlinkingId(id);
    setError(null);
    try {
      const res = await fetch("/api/me/channel-links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ channelIdentityId: id }),
      });
      const json = (await res.json().catch(() => null)) as UnlinkResponse | null;
      if (!res.ok || !json || !json.ok) {
        setError(json && !json.ok ? json.error.message : t("error"));
        return;
      }
      await fetchChannels();
    } catch {
      setError(t("error"));
    } finally {
      setUnlinkingId(null);
    }
  }

  // Platform/status labels resolve through i18n (channelLinks.platform.*) so
  // an unexpected enum value falls back to the raw name rather than crashing.
  function platformLabel(platform: string): string {
    return ["WHATSAPP", "MESSENGER", "INSTAGRAM"].includes(platform)
      ? t(`platform.${platform}`)
      : platform;
  }

  return (
    <Card padding={20}>
      <div className="mg-h4" style={{ margin: "0 0 4px" }}>{t("title")}</div>
      <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>
        {t("subtitle")}
      </div>

      {loading ? (
        <Stack dir="row" gap={10} align="center">
          <Icon name="circle-dashed" size={16} />
          <span className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            {tc("loading")}
          </span>
        </Stack>
      ) : channels.length === 0 ? (
        <div className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
          {t("none")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {channels.map((c) => (
            <Stack key={c.id} dir="row" gap={10} align="center">
              <Badge tone={c.status === "LINKED" ? "success" : "neutral"} icon="message-circle">
                {platformLabel(c.platform)}
              </Badge>
              <span className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", flex: 1 }}>
                {new Date(c.linkedAt).toLocaleDateString()}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={unlinkingId === c.id}
                onClick={() => void unlink(c.id)}
              >
                {unlinkingId === c.id ? tc("loading") : t("unlink")}
              </Button>
            </Stack>
          ))}
        </div>
      )}

      {/* Connect: one button issues a code valid for every platform; deep
          links appear only when the server has the business number/page id. */}
      <div style={{ marginTop: 14 }}>
        <Button size="sm" iconLeft="message-circle" disabled={issuing} onClick={() => void issueCode()}>
          {issuing ? t("generating") : t("connect")}
        </Button>
      </div>

      {issued && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            background: "hsl(var(--surface-2))",
          }}
        >
          <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
            {t("codeLabel")}
          </div>
          <div className="mg-h3" style={{ margin: "4px 0", letterSpacing: 2 }}>{issued.code}</div>
          <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginBottom: 8 }}>
            {t("codeHint", { code: issued.code })}
          </div>
          <Stack dir="row" gap={8} wrap>
            {issued.links.whatsapp && (
              <Button size="sm" variant="outline" onClick={() => window.open(issued.links.whatsapp!, "_blank")}>
                {t("openWhatsApp")}
              </Button>
            )}
            {issued.links.messenger && (
              <Button size="sm" variant="outline" onClick={() => window.open(issued.links.messenger!, "_blank")}>
                {t("openMessenger")}
              </Button>
            )}
          </Stack>
        </div>
      )}

      {error && (
        <div className="mg-caption" style={{ color: "hsl(var(--destructive))", marginTop: 10 }}>
          {error}
        </div>
      )}
    </Card>
  );
}
