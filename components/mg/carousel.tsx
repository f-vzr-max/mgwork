"use client";

import * as React from "react";

export interface MobileCarouselProps {
  children: React.ReactNode;
  desktopCols?: 2 | 3 | 4;
  autoAdvanceMs?: number;
  mobilePeek?: string;
  ariaLabel?: string;
}

const DESKTOP_GRID: Record<2 | 3 | 4, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

/**
 * Mobile-first horizontal carousel with snap scrolling, dot indicators,
 * and auto-advance. On desktop it collapses to a CSS grid.
 */
export function MobileCarousel({
  children,
  desktopCols = 3,
  autoAdvanceMs = 5000,
  ariaLabel,
}: MobileCarouselProps) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const itemRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const items = React.Children.toArray(children);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const resumeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotionRef = React.useRef(false);

  // Track which item is most visible.
  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { idx: number; ratio: number } | null = null;
        for (const entry of entries) {
          const idx = Number((entry.target as HTMLElement).dataset.index);
          if (Number.isNaN(idx)) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { idx, ratio: entry.intersectionRatio };
          }
        }
        if (best && best.ratio > 0.5) {
          setActiveIndex(best.idx);
        }
      },
      { root: track, threshold: [0.25, 0.5, 0.75, 1] },
    );
    itemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items.length]);

  // Honour prefers-reduced-motion.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      reducedMotionRef.current = mq.matches;
      if (mq.matches) setPaused(true);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Pause-on-interaction helper.
  const pauseFor = React.useCallback((ms: number) => {
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    if (reducedMotionRef.current) return;
    resumeTimer.current = setTimeout(() => setPaused(false), ms);
  }, []);

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onTouch = () => pauseFor(8000);
    const onPointer = () => pauseFor(8000);
    track.addEventListener("touchstart", onTouch, { passive: true });
    track.addEventListener("pointerdown", onPointer);
    return () => {
      track.removeEventListener("touchstart", onTouch);
      track.removeEventListener("pointerdown", onPointer);
    };
  }, [pauseFor]);

  // Auto-advance.
  React.useEffect(() => {
    if (paused || reducedMotionRef.current || items.length <= 1) return;
    if (typeof window === "undefined") return;
    // Only auto-advance on mobile (the desktop grid hides the scroll track).
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;
    const interval = setInterval(() => {
      const track = trackRef.current;
      const next = (activeIndex + 1) % items.length;
      const target = itemRefs.current[next];
      if (track && target) {
        const trackRect = track.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const left = targetRect.left - trackRect.left + track.scrollLeft;
        track.scrollTo({ left, behavior: "smooth" });
      }
    }, autoAdvanceMs);
    return () => clearInterval(interval);
  }, [activeIndex, autoAdvanceMs, items.length, paused]);

  // Cleanup any pending resume timer.
  React.useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  const goTo = (idx: number) => {
    const track = trackRef.current;
    const target = itemRefs.current[idx];
    if (track && target) {
      const trackRect = track.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const left = targetRect.left - trackRect.left + track.scrollLeft;
      track.scrollTo({ left, behavior: "smooth" });
      pauseFor(8000);
    }
  };

  return (
    <div aria-label={ariaLabel} role={ariaLabel ? "region" : undefined}>
      <div
        ref={trackRef}
        className={`flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 pl-2 pr-6 scroll-pl-2 md:pl-0 md:pr-0 md:scroll-pl-0 md:overflow-visible md:grid ${DESKTOP_GRID[desktopCols]} md:gap-5 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
      >
        {items.map((child, i) => (
          <div
            key={i}
            data-index={i}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className="snap-start shrink-0 w-[85%] md:w-auto md:shrink"
          >
            {child}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="mt-3 flex justify-center gap-2 md:hidden" role="tablist">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Aller au slide ${i + 1}`}
              onClick={() => goTo(i)}
              className="h-2 w-2 rounded-full transition-colors"
              style={{
                background:
                  i === activeIndex
                    ? "hsl(var(--primary))"
                    : "hsl(var(--border))",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default MobileCarousel;
