"use client";

// Per-candidate action bar for the enterprise talent directory.
//
//   - Target-offer selector: a popover dropdown of the enterprise's ACTIVE
//     offers (passed from the server page). The selected offer is which
//     jobOfferId the Pass/Shortlist action applies to.
//   - Shortlist -> POST /api/applications {candidateId, jobOfferId, action:"shortlist"} (SHORTLISTED)
//   - Pass      -> POST /api/applications {candidateId, jobOfferId, action:"pass"}      (REJECTED)
//   - View profile -> navigate to /enterprise/candidates/${candidateId}
//
// The selected offer is shared across the page via OfferSelectorContext so a
// single selector at the top drives every row's action bar. A row may also be
// rendered standalone (no provider) with its own inline selector.

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "./button";
import { Icon } from "./icon";

export interface OfferOption {
  id: string;
  title: string;
}

type SelectedOffer = {
  offerId: string | null;
  setOfferId: (id: string) => void;
  offers: OfferOption[];
};

const OfferSelectorContext = React.createContext<SelectedOffer | null>(null);

/**
 * Wraps the candidate list so a single offer selection is shared by every row.
 * Render <OfferSelector /> once near the top, then <CandidateActionBar /> per row.
 */
export function OfferSelectorProvider({
  offers,
  children,
}: {
  offers: OfferOption[];
  children: React.ReactNode;
}) {
  const [offerId, setOfferId] = React.useState<string | null>(
    offers[0]?.id ?? null,
  );
  const value = React.useMemo<SelectedOffer>(
    () => ({ offerId, setOfferId, offers }),
    [offerId, offers],
  );
  return (
    <OfferSelectorContext.Provider value={value}>
      {children}
    </OfferSelectorContext.Provider>
  );
}

/** Popover dropdown of the enterprise's ACTIVE offers (mirrors LanguageMenu). */
export function OfferSelector({ className }: { className?: string }) {
  const t = useTranslations("app.enterprise.candidates.actions");
  const ctx = React.useContext(OfferSelectorContext);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!ctx) return null;
  const { offerId, setOfferId, offers } = ctx;

  if (offers.length === 0) {
    return (
      <span
        className="mg-caption"
        style={{ color: "hsl(var(--muted-foreground))" }}
      >
        {t("noActiveOffers")}
      </span>
    );
  }

  const current = offers.find((o) => o.id === offerId) ?? offers[0];

  return (
    <div ref={ref} className={className} style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("offerSelectorAria")}
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-[hsl(var(--surface-2))] transition-colors"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 36,
          maxWidth: 280,
          padding: "0 12px",
          borderRadius: 8,
          border: "1px solid hsl(var(--border))",
          background: "hsl(var(--background))",
          color: "hsl(var(--foreground))",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <Icon name="briefcase" size={14} style={{ color: "hsl(var(--muted-foreground))" }} />
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {current?.title ?? t("offerSelectorPlaceholder")}
        </span>
        <Icon name="chevron-down" size={14} style={{ color: "hsl(var(--muted-foreground))" }} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={t("offerSelectorAria")}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            boxShadow: "var(--shadow-md)",
            padding: 4,
            minWidth: 240,
            maxWidth: 320,
            maxHeight: 280,
            overflowY: "auto",
            zIndex: 50,
          }}
        >
          {offers.map((o) => {
            const active = o.id === current?.id;
            return (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setOfferId(o.id);
                  setOpen(false);
                }}
                className={
                  active ? undefined : "hover:bg-[hsl(var(--surface-2))] transition-colors"
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "8px 10px",
                  border: 0,
                  borderRadius: 6,
                  background: active ? "var(--primary-bg)" : "transparent",
                  color: active ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                  fontWeight: active ? 600 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {o.title}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export interface CandidateActionBarProps {
  candidateId: string;
  /**
   * Optional offers to render a standalone selector (when not wrapped in
   * OfferSelectorProvider). When omitted, the shared context selection is used.
   */
  offers?: OfferOption[];
}

export function CandidateActionBar({ candidateId, offers }: CandidateActionBarProps) {
  const t = useTranslations("app.enterprise.candidates.actions");
  const router = useRouter();
  const ctx = React.useContext(OfferSelectorContext);

  // Standalone local selection only used when there is no shared provider.
  const [localOfferId, setLocalOfferId] = React.useState<string | null>(
    offers?.[0]?.id ?? null,
  );
  const [pending, setPending] = React.useState<"shortlist" | "pass" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const offerId = ctx ? ctx.offerId : localOfferId;
  const localOffers = offers ?? [];

  async function submit(action: "shortlist" | "pass") {
    if (!offerId || pending) return;
    setPending(action);
    setError(null);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ candidateId, jobOfferId: offerId, action }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.ok) {
        setError(json?.error?.message ?? t("error"));
        return;
      }
      // Server list is force-dynamic; refresh so masking/status reflects the change.
      router.refresh();
    } catch {
      setError(t("error"));
    } finally {
      setPending(null);
    }
  }

  const disabled = !offerId || pending !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      {/* Standalone selector only when not driven by a shared provider. */}
      {!ctx && localOffers.length > 0 && (
        <select
          value={localOfferId ?? ""}
          onChange={(e) => setLocalOfferId(e.target.value || null)}
          aria-label={t("offerSelectorAria")}
          style={{
            height: 32,
            maxWidth: 220,
            borderRadius: 6,
            border: "1px solid hsl(var(--input))",
            background: "hsl(var(--background))",
            color: "hsl(var(--foreground))",
            padding: "0 10px",
            fontSize: 13,
            fontFamily: "inherit",
          }}
        >
          {localOffers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </select>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => submit("pass")}
        >
          {pending === "pass" ? t("passing") : t("pass")}
        </Button>
        <Button
          size="sm"
          disabled={disabled}
          onClick={() => submit("shortlist")}
        >
          {pending === "shortlist" ? t("shortlisting") : t("shortlist")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/enterprise/candidates/${candidateId}`)}
        >
          {t("viewProfile")}
        </Button>
      </div>
      {!offerId && (
        <span className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
          {t("selectOfferFirst")}
        </span>
      )}
      {error && (
        <span className="mg-caption" style={{ color: "hsl(var(--destructive))" }}>
          {error}
        </span>
      )}
    </div>
  );
}

export default CandidateActionBar;
