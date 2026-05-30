"use client";

// Job detail panel — client island that owns the tab state.
//
// Receives serialized offer + match data from the server page and renders the
// hero, tabbed body (match / desc / co), and the sticky apply CTA.

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Badge,
  Button,
  Card,
  Icon,
  Progress,
  ScoreGauge,
  Stack,
  gaugeTone,
} from "@/components/mg";

export type JobCriterion = {
  key: string;
  label: string;
  score: number;
  weight: number;
};

export interface JobDetailPanelProps {
  offerId: string;
  title: string;
  description: string;
  sector: string;
  location: string;
  slots: number;
  companyName: string;
  overall: number;
  criteria: JobCriterion[];
  profileScore: number;
}

type TabId = "match" | "desc" | "co";

const TABS: ReadonlyArray<{ id: TabId; labelKey: string }> = [
  { id: "match", labelKey: "matches.jobDetail.tabs.match" },
  { id: "desc", labelKey: "matches.jobDetail.tabs.desc" },
  { id: "co", labelKey: "matches.jobDetail.tabs.co" },
];

export function JobDetailPanel({
  offerId,
  title,
  description,
  sector,
  location,
  slots,
  companyName,
  overall,
  criteria,
  profileScore,
}: JobDetailPanelProps) {
  const t = useTranslations("app.candidate");
  const [tab, setTab] = React.useState<TabId>("match");
  const tone = gaugeTone(overall);
  const profileIncomplete = profileScore < 100;

  return (
    <div style={{ position: "relative", paddingBottom: 96 }}>
      {/* Hero ----------------------------------------------------------- */}
      <div
        style={{
          padding: "20px 16px 16px",
          background: "linear-gradient(180deg, rgba(26,60,110,0.06), transparent)",
        }}
      >
        <Link
          href="/candidate/matches"
          style={{
            color: "hsl(var(--muted-foreground))",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            marginBottom: 12,
          }}
        >
          <Icon name="chevron-left" size={16} />
          {t("matches.jobDetail.backLink")}
        </Link>
        <Stack dir="row" gap={12} align="center" style={{ marginBottom: 8 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: "#FFFFFF",
              border: "1px solid hsl(var(--border))",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "hsl(var(--primary))",
            }}
          >
            <Icon name="building-2" size={20} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
              {companyName} · {location}
            </div>
            <h1 className="mg-h2" style={{ margin: "2px 0 0" }}>{title}</h1>
          </div>
        </Stack>
        <Stack dir="row" gap={6} wrap>
          <Badge tone="neutral" icon="map-pin">{location}</Badge>
          <Badge tone="neutral" icon="briefcase">{sector}</Badge>
          <Badge tone="neutral" icon="users">
            {t("matches.jobDetail.slots", { slots })}
          </Badge>
        </Stack>
      </div>

      {/* Tabs ----------------------------------------------------------- */}
      <div
        role="tablist"
        style={{ display: "flex", padding: "0 16px", borderBottom: "1px solid hsl(var(--border))" }}
      >
        {TABS.map((tabItem) => {
          const active = tab === tabItem.id;
          return (
            <button
              key={tabItem.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(tabItem.id)}
              style={{
                padding: "12px 12px",
                border: 0,
                background: "transparent",
                color: active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                fontWeight: 600,
                fontSize: 13,
                borderBottom: active ? "2px solid hsl(var(--primary))" : "2px solid transparent",
                marginBottom: -1,
                cursor: "pointer",
              }}
            >
              {t(tabItem.labelKey)}
            </button>
          );
        })}
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 20 }}>
        {tab === "match" && (
          <>
            <Card padding={20} surface={2}>
              <Stack dir="row" gap={20} align="center">
                <ScoreGauge value={overall} size={88} stroke={6} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mg-micro" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {t("matches.jobDetail.scoreLabel")}
                  </div>
                  <div className="mg-h3" style={{ margin: "4px 0 0", color: tone.color }}>
                    {tone.label}
                  </div>
                  <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
                    {t("matches.jobDetail.scoreCriteria", { n: criteria.length })}
                  </div>
                </div>
              </Stack>
            </Card>

            <Card padding={20}>
              <h3 className="mg-h4" style={{ margin: 0, marginBottom: 16 }}>{t("matches.jobDetail.matchDetailTitle")}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {criteria.map((c) => (
                  <div key={c.key}>
                    <Stack dir="row" justify="space-between" align="center" style={{ marginBottom: 6 }}>
                      <div className="mg-body-sm" style={{ fontWeight: 500 }}>
                        {c.label}
                        {c.weight > 0 && (
                          <span
                            className="mg-caption"
                            style={{ color: "hsl(var(--muted-foreground))", marginLeft: 8 }}
                          >
                            {c.weight}%
                          </span>
                        )}
                      </div>
                      <span className="mg-tabular" style={{ fontWeight: 600, fontSize: 14 }}>
                        {c.score}
                      </span>
                    </Stack>
                    <Progress
                      value={c.score}
                      tone={c.score >= 80 ? "success" : c.score >= 60 ? "primary" : "warning"}
                    />
                  </div>
                ))}
              </div>
            </Card>

            {profileIncomplete && (
              <Card padding={16}>
                <Stack dir="row" align="center" gap={10} style={{ marginBottom: 4 }}>
                  <Icon name="alert-triangle" size={14} style={{ color: "hsl(var(--warning))" }} />
                  <span className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
                    {t("matches.jobDetail.profileIncompleteLabel", { pct: profileScore })}
                  </span>
                </Stack>
                <div className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {t("matches.jobDetail.profileIncompleteHint")}
                </div>
              </Card>
            )}
          </>
        )}

        {tab === "desc" && (
          <Card padding={20}>
            <h3 className="mg-h4" style={{ margin: 0, marginBottom: 12 }}>{t("matches.jobDetail.descTitle")}</h3>
            <div
              className="mg-body"
              style={{ whiteSpace: "pre-wrap", color: "hsl(var(--foreground))" }}
            >
              {description || t("matches.jobDetail.descEmpty")}
            </div>
          </Card>
        )}

        {tab === "co" && (
          <Card padding={20}>
            <Stack dir="row" gap={12} align="center" style={{ marginBottom: 10 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: "#FFFFFF",
                  border: "1px solid hsl(var(--border))",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "hsl(var(--primary))",
                }}
              >
                <Icon name="building-2" size={22} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="mg-h4" style={{ margin: 0 }}>{companyName}</div>
                <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
                  {sector} · {location}
                </div>
              </div>
            </Stack>
            <div className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              {t("matches.jobDetail.companyRecruiting", { jobTitle: title })}
            </div>
          </Card>
        )}
      </div>

      {/* Sticky bottom action ------------------------------------------ */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 64,
          padding: "12px 16px",
          background: "hsl(var(--background))",
          borderTop: "1px solid hsl(var(--border))",
          display: "flex",
          gap: 8,
          zIndex: 9,
        }}
        className="lg:static lg:border-t-0 lg:p-0 lg:mt-4"
      >
        <Button
          variant="outline"
          size="lg"
          iconLeft="star"
          aria-label={t("matches.jobDetail.saveAriaLabel")}
          style={{ flex: "0 0 auto" }}
        />
        {/* Apply button — POST /api/applications endpoint not yet wired.
            When the contract lands, replace the no-op with a fetch + redirect
            to `/candidate/applications/{id}`. */}
        <Button
          size="lg"
          fullWidth
          aria-label={t("matches.jobDetail.applyAriaLabel", { jobTitle: title })}
          data-offer-id={offerId}
          disabled={profileIncomplete}
        >
          {profileIncomplete ? t("matches.jobDetail.finishProfileButton") : t("matches.jobDetail.applyButton")}
        </Button>
      </div>
    </div>
  );
}
