// Candidate chat transcript loader — GET source for the chat drawer.
//
// The drawer is client-side and the old /candidate/chat page (its only prior
// loader) is now a redirect, so the drawer fetches the IN_APP transcript here
// on first open. Returns { messages, lang } — `lang` feeds CandChatPanel's
// required prop. Auth gate mirrors POST /api/chat (app/api/chat/route.ts).

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { loadTranscript } from "@/lib/social/llm-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Sign-in required" }, { status: 401 });
  }

  const allowed = await rateLimit(clerkId, "chat.transcript", 10, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { role: true, lang: true, candidate: { select: { id: true } } },
  });
  if (!user) {
    return NextResponse.json({ error: "User profile not yet synced" }, { status: 404 });
  }
  if (user.role !== "CANDIDATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!user.candidate) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 404 });
  }

  const transcript = await loadTranscript(user.candidate.id);
  return NextResponse.json(
    {
      messages: transcript.map((m) => ({ role: m.role, text: m.text, at: m.at })),
      lang: user.lang,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
