"use client";

// MG Work — Candidate profile (W2-C, MVP).
//
// Shows the signed-in candidate their OWN info, photo and basic preferences,
// and lets them edit the text fields + upload a profile photo. All reads and
// writes go through /api/candidates/me (+ /me/avatar), which resolve the
// candidate id from the Clerk session — this page never sends an id, so it can
// only ever read/write the caller's own row.

import * as React from "react";
import { useTranslations } from "next-intl";
import { Avatar, Badge, Button, Card, Icon, Input, Stack, Textarea } from "@/components/mg";
import ChannelLinksCard from "./channel-links-card";

type CandidateSelf = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  nationality: string;
  phone: string | null;
  city: string | null;
  bio: string | null;
  skills: string[];
  sectors: string[];
  langScoreFR: number | null;
  langScoreEN: number | null;
  langScoreFRVerifiedAt: string | null;
  langScoreENVerifiedAt: string | null;
  profileScore: number;
  hasAvatar: boolean;
  hasCv: boolean;
};

type MeResponse =
  | { ok: true; data: { candidate: CandidateSelf } }
  | { ok: false; error: { message: string; fieldErrors?: Record<string, string[]> } };

type AvatarResponse =
  | { ok: true; data: { url: string | null; expiresAt: string | null } }
  | { ok: false; error: { message: string } };

// Editable text fields only — mirrors the server self-update schema.
type EditForm = {
  firstName: string;
  lastName: string;
  city: string;
  phone: string;
  bio: string;
};

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME = ["image/jpeg", "image/png", "image/webp"];

function toEditForm(c: CandidateSelf): EditForm {
  return {
    firstName: c.firstName ?? "",
    lastName: c.lastName ?? "",
    city: c.city ?? "",
    phone: c.phone ?? "",
    bio: c.bio ?? "",
  };
}

export default function CandidateProfilePage(): React.ReactElement {
  const t = useTranslations("app.candidate.profile");
  const tc = useTranslations("common");
  const tl = useTranslations("langTest");

  const [candidate, setCandidate] = React.useState<CandidateSelf | null>(null);
  const [edit, setEdit] = React.useState<EditForm | null>(null);
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const fetchProfile = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/candidates/me", { credentials: "same-origin" });
      const json = (await res.json().catch(() => null)) as MeResponse | null;
      if (!res.ok || !json || !json.ok) {
        setLoadError(json && !json.ok ? json.error.message : tc("error"));
        return;
      }
      setCandidate(json.data.candidate);
      setEdit(toEditForm(json.data.candidate));
    } catch {
      setLoadError(tc("error"));
    } finally {
      setLoading(false);
    }
  }, [tc]);

  const fetchAvatar = React.useCallback(async () => {
    try {
      const res = await fetch("/api/candidates/me/avatar", {
        credentials: "same-origin",
      });
      const json = (await res.json().catch(() => null)) as AvatarResponse | null;
      if (res.ok && json && json.ok) setAvatarUrl(json.data.url);
    } catch {
      // best-effort; fall back to initials avatar
    }
  }, []);

  React.useEffect(() => {
    void fetchProfile();
    void fetchAvatar();
  }, [fetchProfile, fetchAvatar]);

  const onField = (key: keyof EditForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setEdit((prev) => (prev ? { ...prev, [key]: e.target.value } : prev));
    setSaved(false);
  };

  async function save() {
    if (!edit) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      // Send text fields only. avatarUrl is never sent from here — it is owned
      // exclusively by the avatar upload route.
      const res = await fetch("/api/candidates/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          firstName: edit.firstName,
          lastName: edit.lastName,
          city: edit.city || null,
          phone: edit.phone || null,
          bio: edit.bio || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as MeResponse | null;
      if (!res.ok || !json || !json.ok) {
        setSaveError(json && !json.ok ? json.error.message : t("saveError"));
        return;
      }
      setCandidate(json.data.candidate);
      setEdit(toEditForm(json.data.candidate));
      setSaved(true);
    } catch {
      setSaveError(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setUploadError(null);
    if (!ALLOWED_AVATAR_MIME.includes(file.type)) {
      setUploadError(t("photoTypeError"));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setUploadError(t("photoSizeError"));
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/candidates/me/avatar", {
        method: "POST",
        credentials: "same-origin",
        body,
      });
      const json = (await res.json().catch(() => null)) as AvatarResponse | null;
      if (!res.ok || !json || !json.ok) {
        setUploadError(json && !json.ok ? json.error.message : t("photoUploadError"));
        return;
      }
      if (json.data.url) setAvatarUrl(json.data.url);
      setCandidate((prev) => (prev ? { ...prev, hasAvatar: true } : prev));
    } catch {
      setUploadError(t("photoUploadError"));
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <Card padding={20}>
          <Stack dir="row" gap={10} align="center">
            <Icon name="circle-dashed" size={18} />
            <span className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
              {tc("loading")}
            </span>
          </Stack>
        </Card>
      </div>
    );
  }

  if (loadError || !candidate || !edit) {
    return (
      <div style={{ padding: 16 }}>
        <Card padding={20}>
          <div className="mg-h4" style={{ margin: 0 }}>{tc("error")}</div>
          <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
            {loadError ?? tc("error")}
          </div>
          <Button style={{ marginTop: 12 }} size="sm" variant="outline" onClick={() => void fetchProfile()}>
            {tc("refresh")}
          </Button>
        </Card>
      </div>
    );
  }

  const fullName = `${candidate.firstName} ${candidate.lastName}`.trim();

  return (
    <div style={{ padding: 16 }} className="lg:grid lg:grid-cols-[minmax(0,720px)_1fr] lg:gap-8 lg:items-start">
      {/* Left column: form content */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h1 className="mg-h1" style={{ margin: 0, fontSize: 26, lineHeight: "32px" }}>
            {t("title")}
          </h1>
          <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
            {t("subtitle")}
          </div>
        </div>

        {/* Photo --------------------------------------------------------- */}
        <Card padding={20}>
          <Stack dir="row" gap={16} align="center">
            <Avatar name={fullName} size={72} src={avatarUrl ?? undefined} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mg-h4" style={{ margin: 0 }}>{t("photoTitle")}</div>
              <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
                {t("photoHint")}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept={ALLOWED_AVATAR_MIME.join(",")}
                onChange={onPickFile}
                style={{ display: "none" }}
              />
              <Button
                size="sm"
                variant="outline"
                iconLeft="upload"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                style={{ marginTop: 10 }}
              >
                {uploading ? tc("loading") : t("photoUpload")}
              </Button>
            </div>
          </Stack>
          {uploadError && (
            <div className="mg-caption" style={{ color: "hsl(var(--destructive))", marginTop: 10 }}>
              {uploadError}
            </div>
          )}
        </Card>

        {/* Info ---------------------------------------------------------- */}
        <Card padding={20}>
          <div className="mg-h4" style={{ margin: "0 0 12px" }}>{t("infoTitle")}</div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("firstName")}>
              <Input value={edit.firstName} onChange={onField("firstName")} autoComplete="given-name" />
            </Field>
            <Field label={t("lastName")}>
              <Input value={edit.lastName} onChange={onField("lastName")} autoComplete="family-name" />
            </Field>
            <Field label={t("city")}>
              <Input value={edit.city} onChange={onField("city")} autoComplete="address-level2" />
            </Field>
            <Field label={t("phone")}>
              <Input value={edit.phone} onChange={onField("phone")} inputMode="tel" autoComplete="tel" />
            </Field>
            <div className="md:col-span-2">
              <Field label={t("bio")}>
                <Textarea value={edit.bio} onChange={onField("bio")} maxLength={2000} rows={4} />
              </Field>
            </div>
          </div>

          {saveError && (
            <div className="mg-caption" style={{ color: "hsl(var(--destructive))", marginTop: 12 }}>
              {saveError}
            </div>
          )}
          <Stack dir="row" gap={10} align="center" style={{ marginTop: 16 }}>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? tc("loading") : tc("save")}
            </Button>
            {saved && (
              <span className="mg-caption" style={{ color: "hsl(var(--success, var(--primary)))" }}>
                {t("savedNote")}
              </span>
            )}
          </Stack>
        </Card>

        {/* Preferences (read-only MVP) ----------------------------------- */}
        <Card padding={20}>
          <div className="mg-h4" style={{ margin: "0 0 12px" }}>{t("preferencesTitle")}</div>
          <ReadOnlyList label={t("skills")} values={candidate.skills} empty={t("none")} />
          <div style={{ height: 12 }} />
          <ReadOnlyList label={t("sectors")} values={candidate.sectors} empty={t("none")} />
          <div style={{ height: 12 }} />
          {/* Languages — scores are server-managed; a "verified" badge appears
              once the AI test (/candidate/language-test) stamped the level. */}
          <div>
            <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginBottom: 6 }}>
              {tl("profile.title")}
            </div>
            <Stack dir="row" gap={8} wrap>
              {candidate.langScoreFRVerifiedAt ? (
                <Badge tone="success" icon="check-circle-2">
                  {tl("badge.fr", { score: candidate.langScoreFR ?? 0 })}
                </Badge>
              ) : candidate.langScoreFR != null ? (
                <Badge tone="neutral">{tl("badge.frSelf", { score: candidate.langScoreFR })}</Badge>
              ) : (
                <Badge tone="neutral">{tl("badge.frNone")}</Badge>
              )}
              {candidate.langScoreENVerifiedAt ? (
                <Badge tone="success" icon="check-circle-2">
                  {tl("badge.en", { score: candidate.langScoreEN ?? 0 })}
                </Badge>
              ) : candidate.langScoreEN != null ? (
                <Badge tone="neutral">{tl("badge.enSelf", { score: candidate.langScoreEN })}</Badge>
              ) : (
                <Badge tone="neutral">{tl("badge.enNone")}</Badge>
              )}
            </Stack>
          </div>
          <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginTop: 12 }}>
            {t("preferencesEditHint")}
          </div>
        </Card>

        {/* Connected channels (WhatsApp / Messenger / Instagram) ---------- */}
        <ChannelLinksCard />
      </div>

      {/* Right rail: profile-completeness summary (lg+ only) */}
      <ProfileRail candidate={candidate} />
    </div>
  );
}

function ProfileRail({ candidate }: { candidate: CandidateSelf }) {
  const t = useTranslations("app.candidate.profile");
  const tl = useTranslations("langTest");

  const checklist = [
    { label: t("photoTitle"), done: candidate.hasAvatar },
    { label: t("rail.cv"), done: candidate.hasCv },
    { label: tl("profile.title"), done: candidate.langScoreFRVerifiedAt != null || candidate.langScoreENVerifiedAt != null },
  ];

  return (
    <aside className="cand-page-rail hidden lg:block" style={{ paddingTop: 44 }}>
      <Card padding={20}>
        <div className="mg-h4" style={{ margin: "0 0 4px" }}>{t("rail.title")}</div>
        <div className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))", marginBottom: 14 }}>
          {t("rail.score", { score: candidate.profileScore })}
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 9999,
            background: "hsl(var(--surface-2))",
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${candidate.profileScore}%`,
              background: "hsl(var(--primary))",
              borderRadius: 9999,
              transition: "width 0.3s",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {checklist.map(({ label, done }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon
                name={done ? "check-circle-2" : "circle"}
                size={16}
                style={{ color: done ? "hsl(var(--success, var(--primary)))" : "hsl(var(--muted-foreground))", flexShrink: 0 }}
              />
              <span className="mg-body-sm" style={{ color: done ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}>
                {label}
              </span>
              <span className="mg-caption" style={{ marginLeft: "auto", color: done ? "hsl(var(--success, var(--primary)))" : "hsl(var(--muted-foreground))" }}>
                {done ? t("rail.done") : t("rail.missing")}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block w-full mg-body-sm font-medium text-foreground">
      {label}
      <div style={{ marginTop: 4 }}>{children}</div>
    </label>
  );
}

function ReadOnlyList({
  label,
  values,
  empty,
}: {
  label: string;
  values: string[];
  empty: string;
}) {
  return (
    <div>
      <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))", marginBottom: 6 }}>
        {label}
      </div>
      {values.length === 0 ? (
        <div className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))" }}>{empty}</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {values.map((v) => (
            <span
              key={v}
              style={{
                fontSize: 14,
                padding: "4px 10px",
                borderRadius: 9999,
                background: "hsl(var(--surface-2))",
                color: "hsl(var(--foreground))",
              }}
            >
              {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
