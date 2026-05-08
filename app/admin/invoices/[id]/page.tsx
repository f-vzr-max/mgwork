// Invoice detail page — shows the invoice + an action to mark it paid.

import { notFound } from "next/navigation";
import Link from "next/link";
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

  return (
    <>
      <PageHeader
        title={`Invoice ${invoice.reference ?? invoice.id.slice(0, 8)}`}
        description={`${invoice.enterprise.companyName} — issued ${invoice.issuedAt.toISOString().slice(0, 10)}`}
      >
        <Link href="/admin/invoices" className="text-sm text-primary hover:underline">
          ← Back to invoices
        </Link>
      </PageHeader>

      <div className="grid gap-4 p-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>
              <span className="text-muted-foreground">Amount:</span>{" "}
              {invoice.amount.toFixed(2)} {invoice.currency}
            </div>
            <div>
              <span className="text-muted-foreground">Method:</span>{" "}
              {invoice.paymentMethod}
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>{" "}
              <span className="font-mono">{invoice.status}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Issued:</span>{" "}
              {invoice.issuedAt.toISOString()}
            </div>
            {invoice.paidAt ? (
              <div>
                <span className="text-muted-foreground">Paid:</span>{" "}
                {invoice.paidAt.toISOString()}
              </div>
            ) : null}
            {invoice.reference ? (
              <div>
                <span className="text-muted-foreground">Reference:</span>{" "}
                {invoice.reference}
              </div>
            ) : null}
            {invoice.notes ? (
              <div>
                <span className="text-muted-foreground">Notes:</span>{" "}
                <span className="whitespace-pre-wrap">{invoice.notes}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {invoice.status === "PAID" ? "Already paid" : "Mark as paid"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.status === "PAID" ? (
              <p className="text-sm text-muted-foreground">
                This invoice was paid on{" "}
                {invoice.paidAt
                  ? invoice.paidAt.toISOString().slice(0, 10)
                  : "an unknown date"}
                .
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
