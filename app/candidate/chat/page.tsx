// Candidate-side chat with the MG Work onboarding agent.
//
// Server-renders the existing IN_APP transcript so the UI is fast and SEO-
// safe, then hands off to a client island that hydrates the live composer +
// streaming reply path.

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { loadTranscript } from "@/lib/social/llm-bridge";
import { PageHeader } from "@/components/layout/page-header";
import { ChatPanel } from "./chat-panel";

export const dynamic = "force-dynamic";

export default async function CandidateChatPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      role: true,
      lang: true,
      candidate: { select: { id: true } },
    },
  });

  if (!user) redirect("/sign-in");
  if (user.role !== "CANDIDATE") redirect("/");
  if (!user.candidate) redirect("/onboarding");

  const transcript = await loadTranscript(user.candidate.id);

  return (
    <>
      <PageHeader
        title="Onboarding chat"
        description="Tell the MG Work agent about yourself — it'll fill in your profile as you talk."
      />
      <div className="flex h-[calc(100vh-9rem)] flex-col bg-background">
        <ChatPanel
          initialMessages={transcript.map((m) => ({
            role: m.role,
            text: m.text,
            at: m.at,
          }))}
          lang={user.lang}
        />
      </div>
    </>
  );
}
