// MG Work — Create offer form (M5).
//
// Client component. Submits to POST /api/offers. Status defaults to DRAFT;
// the user can flip to ACTIVE on submit (which triggers the freemium check
// server-side).

"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LANG_CODES = ["FR", "EN", "MG"] as const;

function splitCsv(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export default function NewOfferPage() {
  const t = useTranslations("app.enterprise");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState({
    title: "",
    description: "",
    sector: "",
    location: "Mauritius",
    slots: 1,
    requirements: "",
    langRequired: ["FR"] as string[],
    status: "DRAFT" as "DRAFT" | "ACTIVE",
  });

  function update<K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function toggleLang(code: string, checked: boolean) {
    setFields((f) => ({
      ...f,
      langRequired: checked
        ? Array.from(new Set([...f.langRequired, code]))
        : f.langRequired.filter((c) => c !== code),
    }));
  }

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        title: fields.title.trim(),
        description: fields.description.trim(),
        sector: fields.sector.trim(),
        location: fields.location.trim() || "Mauritius",
        slots: Number(fields.slots) || 1,
        status: fields.status,
        requirements: splitCsv(fields.requirements),
        langRequired: fields.langRequired,
      };
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as
        | { ok: true; data: { offerId: string } }
        | { ok: false; error: { message: string } };
      if (!res.ok || !("ok" in json) || !json.ok) {
        const msg =
          json && "error" in json && json.error?.message ? json.error.message : t("offers.new.error.couldNotCreate");
        setError(msg);
        return;
      }
      router.push(`/enterprise/offers/${json.data.offerId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("offers.new.error.network"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title={t("offers.new.pageTitle")} description={t("offers.new.pageDescription")} />
      <div className="p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{t("offers.new.cardTitle")}</CardTitle>
            <CardDescription>
              {t("offers.new.cardDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="title">
                  {t("offers.new.field.title")}
                </label>
                <Input
                  id="title"
                  required
                  maxLength={240}
                  value={fields.title}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder={t("offers.new.field.titlePlaceholder")}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="description">
                  {t("offers.new.field.description")}
                </label>
                <textarea
                  id="description"
                  required
                  maxLength={8000}
                  className="flex min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={fields.description}
                  onChange={(e) => update("description", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="sector">
                    {t("offers.new.field.sector")}
                  </label>
                  <Input
                    id="sector"
                    required
                    maxLength={80}
                    value={fields.sector}
                    onChange={(e) => update("sector", e.target.value)}
                    placeholder={t("offers.new.field.sectorPlaceholder")}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="location">
                    {t("offers.new.field.location")}
                  </label>
                  <Input
                    id="location"
                    maxLength={120}
                    value={fields.location}
                    onChange={(e) => update("location", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="slots">
                    {t("offers.new.field.slots")}
                  </label>
                  <Input
                    id="slots"
                    type="number"
                    min={1}
                    max={1000}
                    value={fields.slots}
                    onChange={(e) => update("slots", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="status">
                    {t("offers.new.field.status")}
                  </label>
                  <select
                    id="status"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={fields.status}
                    onChange={(e) => update("status", e.target.value as "DRAFT" | "ACTIVE")}
                  >
                    <option value="DRAFT">{t("offers.new.status.DRAFT")}</option>
                    <option value="ACTIVE">{t("offers.new.status.ACTIVE")}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="requirements">
                  {t("offers.new.field.requirements")}
                </label>
                <textarea
                  id="requirements"
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder={t("offers.new.field.requirementsPlaceholder")}
                  value={fields.requirements}
                  onChange={(e) => update("requirements", e.target.value)}
                />
              </div>

              <fieldset className="space-y-1">
                <legend className="text-sm font-medium">{t("offers.new.field.languagesRequired")}</legend>
                <div className="flex gap-4 pt-1">
                  {LANG_CODES.map((code) => (
                    <label key={code} className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={fields.langRequired.includes(code)}
                        onChange={(e) => toggleLang(code, e.target.checked)}
                      />
                      {code}
                    </label>
                  ))}
                </div>
              </fieldset>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={submitting}>
                  {submitting ? t("offers.new.button.saving") : t("offers.new.button.save")}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/enterprise/offers">{t("offers.new.button.cancel")}</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
