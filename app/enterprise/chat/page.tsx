// MG Work — Enterprise AI assistant chat.
//
// Server-renders the existing [enterpriseId, IN_APP] transcript (persisted by
// `lib/social/enterprise-assistant`) and hands off to the shared SSE chat
// panel through the thin `EnterpriseChatPanel` client wrapper. Replies stream
// through the same `/api/chat` endpoint as the candidate chat — the route
// branches on role.

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { loadEnterpriseTranscript } from "@/lib/social/enterprise-assistant";
import { PageHeader } from "@/components/mg";
import { EnterpriseChatPanel } from "./chat-panel";

export const dynamic = "force-dynamic";

export default async function EnterpriseChatPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      role: true,
      lang: true,
      enterprise: { select: { id: true } },
    },
  });
  if (!user) redirect("/sign-in");
  if (user.role !== "ENTERPRISE") redirect("/");
  if (!user.enterprise) redirect("/onboarding");

  const t = await getTranslations("assistantChat");
  const transcript = await loadEnterpriseTranscript(user.enterprise.id);
  const initialMessages = transcript.map((m) => ({
    role: m.role,
    text: m.text,
    at: m.at,
  }));

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div style={{ width: "100%", maxWidth: 720, margin: "0 auto" }}>
        <EnterpriseChatPanel initialMessages={initialMessages} lang={user.lang} />
      </div>
    </>
  );
}
