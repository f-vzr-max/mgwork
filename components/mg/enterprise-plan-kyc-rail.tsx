// Async server component — plan quota + KYC document health rail.
// Receives pre-computed values from the parent page so it can be wrapped
// in <Suspense> without re-running the heavy Prisma queries.

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { statusLabel } from "./status-badge";
import { Badge, Button, Card, Hairline, Icon, Progress, Stack, StatusBadge } from ".";

export interface EnterprisePlanKycRailProps {
  offersUsed: number;
  activeOffersLimit: number | null;
  offerPct: number;
  presetUsed: number;
  presetLimit: number;
  presetPct: number;
  kycExpiringSoon: number;
  planLabel: string;
}

export async function EnterprisePlanKycRail({
  offersUsed,
  activeOffersLimit,
  offerPct,
  presetUsed,
  presetLimit,
  presetPct,
  kycExpiringSoon,
  planLabel,
}: EnterprisePlanKycRailProps) {
  const t = await getTranslations("app.enterprise.dashboard");
  const tStatus = await getTranslations("status");

  const kycDocs = [
    { name: t("kyc.docIncorporation"), icon: "building-2", status: "APPROVED" },
    { name: t("kyc.docSignatoryPower"), icon: "file-text", status: "APPROVED" },
    {
      name: t("kyc.docTaxClearance"),
      icon: "file-text",
      status: kycExpiringSoon > 0 ? "EXPIRING_SOON" : "APPROVED",
    },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card padding={20}>
        <Stack dir="row" justify="space-between" align="center" style={{ marginBottom: 4 }}>
          <span className="mg-micro" style={{ color: "hsl(var(--muted-foreground))" }}>
            {planLabel}
          </span>
          <Badge tone="success" icon="check-circle-2">
            {t("plan.activeStatus")}
          </Badge>
        </Stack>
        <div className="mg-h2" style={{ margin: "8px 0 0" }}>
          {presetUsed} / {presetLimit}
        </div>
        <div
          className="mg-caption"
          style={{ color: "hsl(var(--muted-foreground))", marginBottom: 12 }}
        >
          {t("plan.preselectionsUsed")}
        </div>
        <Progress value={presetPct} />
        <Hairline style={{ margin: "16px 0" }} />
        <div className="mg-body-sm" style={{ fontWeight: 600, marginBottom: 8 }}>
          {t("plan.activeOffersLabel")}
        </div>
        <div className="mg-h2" style={{ margin: 0 }}>
          {offersUsed} / {activeOffersLimit ?? "∞"}
        </div>
        <Progress value={offerPct} style={{ marginTop: 8 }} />
        <Link href="/tarifs" style={{ textDecoration: "none", display: "block", marginTop: 16 }}>
          <Button variant="outline" fullWidth iconRight="arrow-up-right">
            {t("plan.upgradeButton")}
          </Button>
        </Link>
      </Card>

      <Card padding={20}>
        <Stack dir="row" justify="space-between" align="center" style={{ marginBottom: 12 }}>
          <h3 className="mg-h4" style={{ margin: 0 }}>
            {t("kyc.title")}
          </h3>
          {kycExpiringSoon > 0 ? (
            <Badge tone="warning" icon="alert-triangle">
              {t("kyc.expiringSoon", { count: kycExpiringSoon })}
            </Badge>
          ) : (
            <Badge tone="success" icon="check-circle-2">
              {t("kyc.upToDate")}
            </Badge>
          )}
        </Stack>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {kycDocs.map((d) => (
            <Stack key={d.name} dir="row" gap={10} align="center">
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: "hsl(var(--surface-3))",
                  color: "hsl(var(--foreground))",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={d.icon} size={14} />
              </div>
              <span className="mg-body-sm" style={{ flex: 1, minWidth: 0 }}>
                {d.name}
              </span>
              <StatusBadge status={d.status} label={statusLabel(d.status, tStatus)} />
            </Stack>
          ))}
        </div>
        <Link
          href="/enterprise/documents"
          style={{ textDecoration: "none", display: "block", marginTop: 16 }}
        >
          <Button variant="outline" fullWidth iconRight="arrow-right">
            {t("kyc.manageButton")}
          </Button>
        </Link>
      </Card>
    </div>
  );
}
