// Invoice detail page — shows the invoice + an action to mark it paid.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { MarkPaidForm } from "@/components/admin/MarkPaidForm";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      enterprise: {
        select: { id: true, companyName: true, contactName: true },
      },
    },
  });
  if (!invoice) return notFound();
  const t = await getTranslations("app.admin");

  return (
    <>
      <PageHeader
        title={t("invoices.detail.title", { reference: invoice.reference ?? invoice.id.slice(0, 8) })}
        description={t("invoices.detail.description", { companyName: invoice.enterprise.companyName, issuedAt: invoice.issuedAt.toISOString().slice(0, 10) })}
      >
        <Link href="/admin/invoices" className="text-sm text-primary hover:underline">
          {t("invoices.detail.backLink")}
        </Link>
      </PageHeader>

      <div className="grid gap-4 p-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("invoices.detail.sectionDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>
              <span className="text-muted-foreground">{t("invoices.detail.labelAmount")}</span>{" "}
              {invoice.amount.toFixed(2)} {invoice.currency}
            </div>
            <div>
              <span className="text-muted-foreground">{t("invoices.detail.labelMethod")}</span>{" "}
              {invoice.paymentMethod}
            </div>
            <div>
              <span className="text-muted-foreground">{t("invoices.detail.labelStatus")}</span>{" "}
              <span className="font-mono">{invoice.status}</span>
            </div>
            <div>
              <span className="text-muted-foreground">{t("invoices.detail.labelIssued")}</span>{" "}
              {invoice.issuedAt.toISOString()}
            </div>
            {invoice.paidAt ? (
              <div>
                <span className="text-muted-foreground">{t("invoices.detail.labelPaid")}</span>{" "}
                {invoice.paidAt.toISOString()}
              </div>
            ) : null}
            {invoice.reference ? (
              <div>
                <span className="text-muted-foreground">{t("invoices.detail.labelReference")}</span>{" "}
                {invoice.reference}
              </div>
            ) : null}
            {invoice.notes ? (
              <div>
                <span className="text-muted-foreground">{t("invoices.detail.labelNotes")}</span>{" "}
                <span className="whitespace-pre-wrap">{invoice.notes}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {invoice.status === "PAID" ? t("invoices.detail.alreadyPaidTitle") : t("invoices.detail.markPaidTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.status === "PAID" ? (
              <p className="text-sm text-muted-foreground">
                {t("invoices.detail.paidOnMessage", {
                  paidAt: invoice.paidAt
                    ? invoice.paidAt.toISOString().slice(0, 10)
                    : t("invoices.detail.unknownDate"),
                })}
              </p>
            ) : (
              <MarkPaidForm
                invoiceId={invoice.id}
                defaultMethod={invoice.paymentMethod}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
