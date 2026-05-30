"use client";

// Translations editor. Lets admins switch languages via querystring + add /
// edit individual key/value rows. Uses an unsaved-edit buffer per row.

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Translation = {
  id: string;
  lang: "FR" | "EN" | "MG";
  key: string;
  value: string;
};

type Props = {
  selectedLang: "FR" | "EN" | "MG";
  languages: ReadonlyArray<"FR" | "EN" | "MG">;
  initial: Translation[];
};

export function TranslationsManager({ selectedLang, languages, initial }: Props) {
  const t = useTranslations("app.admin");
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = React.useState<Translation[]>(initial);
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [newKey, setNewKey] = React.useState("");
  const [newValue, setNewValue] = React.useState("");

  function switchLang(lang: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", lang);
    router.push(`/admin/i18n?${params.toString()}`);
  }

  async function upsert(lang: "FR" | "EN" | "MG", key: string, value: string) {
    const body = { lang, key, value };
    const res = await fetch("/api/admin/translations", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok: boolean; data?: { id: string }; error?: { message?: string } }
      | null;
    if (!res.ok || !data?.ok) {
      setError(data?.error?.message ?? tc("requestFailed", { status: res.status }));
      return null;
    }
    return data.data ?? null;
  }

  async function saveRow(row: Translation) {
    const newValue = edits[row.id];
    if (newValue === undefined || newValue === row.value) return;
    setBusy(row.id);
    setError(null);
    try {
      const data = await upsert(row.lang, row.key, newValue);
      if (data) {
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, value: newValue } : r)),
        );
        setEdits((prev) => {
          const copy = { ...prev };
          delete copy[row.id];
          return copy;
        });
      }
    } finally {
      setBusy(null);
    }
  }

  async function addNew(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!newKey.trim()) return;
    setBusy("__new__");
    setError(null);
    try {
      const data = await upsert(selectedLang, newKey.trim(), newValue);
      if (data) {
        setRows((prev) => {
          const filtered = prev.filter(
            (r) => !(r.key === newKey.trim() && r.lang === selectedLang),
          );
          return [
            ...filtered,
            {
              id: data.id,
              lang: selectedLang,
              key: newKey.trim(),
              value: newValue,
            },
          ].sort((a, b) => a.key.localeCompare(b.key));
        });
        setNewKey("");
        setNewValue("");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{t("i18nManager.languageLabel")}</span>
        {languages.map((l) => (
          <Button
            key={l}
            type="button"
            size="sm"
            variant={l === selectedLang ? "default" : "outline"}
            onClick={() => switchLang(l)}
          >
            {l}
          </Button>
        ))}
      </div>

      {error ? (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 text-sm font-semibold">{t("i18nManager.addTitle")}</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={addNew}>
          <label className="flex flex-col gap-1 text-sm">
            <span>{tc("key")}</span>
            <Input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="onboarding.welcome.title"
              className="w-72"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm flex-1 min-w-[280px]">
            <span>{tc("value")}</span>
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder={t("i18nManager.valuePlaceholder")}
            />
          </label>
          <Button type="submit" disabled={busy === "__new__"}>
            {tc("save")}
          </Button>
        </form>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">
          {t("i18nManager.translationsCount", { lang: selectedLang, count: rows.length })}
        </h2>
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="p-3 w-1/3">{tc("key")}</th>
              <th className="p-3">{tc("value")}</th>
              <th className="p-3 text-right w-32">{tc("action")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-6 text-center text-muted-foreground">
                  {t("i18nManager.empty")}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const draft = edits[row.id] ?? row.value;
                const dirty = draft !== row.value;
                return (
                  <tr key={row.id} className="border-b last:border-b-0 align-top">
                    <td className="p-3 font-mono text-xs">{row.key}</td>
                    <td className="p-3">
                      <Input
                        value={draft}
                        onChange={(e) =>
                          setEdits((prev) => ({ ...prev, [row.id]: e.target.value }))
                        }
                      />
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant={dirty ? "default" : "outline"}
                        disabled={!dirty || busy === row.id}
                        onClick={() => saveRow(row)}
                      >
                        {busy === row.id ? "..." : tc("save")}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
