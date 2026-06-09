"use client";

import * as React from "react";

// SSR-safe media-query hook.
//
// On the server and on the first client render we return `defaultValue` (the
// desktop assumption) so the markup is identical on both sides — no hydration
// mismatch. After mount we read the real `matchMedia` value in an effect and
// subscribe to changes.
//
// NOTE: this is a *behavioural* helper for client logic (e.g. wiring up a
// drawer). It must NOT be used to swap which subtree renders the page
// `children`; layout responsiveness is driven by Tailwind `lg:` utilities so
// the server can keep ownership of the children tree.
export function useMediaQuery(query: string, defaultValue = true): boolean {
  const [matches, setMatches] = React.useState(defaultValue);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    // addEventListener is the modern API; older Safari only has addListener.
    if (mql.addEventListener) {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}

export default useMediaQuery;
