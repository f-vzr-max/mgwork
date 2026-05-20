// MG Work — Candidate advisor chat.
//
// Server-renders the existing IN_APP transcript and hands off to a redesigned
// client island (`CandChatPanel`) that owns the quick-prompt rail + composer
// and streams replies through `/api/chat`.

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { loadTranscript } from "@/lib/social/llm-bridge";
import { CandChatPanel } from "./chat-panel";

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
  const initialMessages = transcript.map((m) => ({
    role: m.role,
    text: m.text,
    at: m.at,
  }));

  return <CandChatPanel initialMessages={initialMessages} lang={user.lang} />;
}
