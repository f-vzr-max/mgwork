// MG Work — Candidate advisor chat (legacy route).
//
// The chat is now a toggleable drawer in the candidate shell, not a page.
// This route redirects to /candidate?openChat=1 so old links + the
// CandTabBar/CountryGuide deep-links still open the drawer; any ?prefill is
// forwarded (capped) so the composer seeds.

import { redirect } from "next/navigation";

export default function CandidateChatPage({
  searchParams,
}: {
  searchParams?: { prefill?: string };
}) {
  const prefill = searchParams?.prefill;
  const target =
    prefill && prefill.length > 0
      ? `/candidate?openChat=1&prefill=${encodeURIComponent(prefill.slice(0, 500))}`
      : "/candidate?openChat=1";
  redirect(target);
}
