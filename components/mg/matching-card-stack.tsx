"use client";

import * as React from "react";
import { Avatar, Card, Hairline, ScoreGauge, Stack } from "@/components/mg";

export interface MatchingCard {
  name: string;
  short: string;
  origin: string;
  score: number;
  role: string;
}

const DEFAULT_MATCHING_CARDS: MatchingCard[] = [
  {
    name: "Tahiry Razafy",
    short: "Tahiry R.",
    origin: "Antananarivo · Hôtellerie",
    score: 87,
    role: "Réceptionniste · Hôtel Lux, Maurice",
  },
  {
    name: "Naina Andriana",
    short: "Naina A.",
    origin: "Mahajanga · Construction",
    score: 74,
    role: "Charpentier · BTP Réunion SA",
  },
  {
    name: "Iary Rakoto",
    short: "Iary R.",
    origin: "Toamasina · Santé",
    score: 92,
    role: "Aide-soignant · Clinique Seychelles",
  },
];

const DESKTOP_POSITIONS = [
  { top: 36, left: 0, right: 24, rotate: -2 },
  { top: 130, left: 64, right: -16, rotate: 1.5 },
  { top: 234, left: 24, right: 8, rotate: -0.8 },
];

function CardBody({ card, forLabel }: { card: MatchingCard; forLabel: string }) {
  return (
    <>
      <Stack dir="row" gap={16} align="center">
        <Avatar name={card.name} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mg-h4">{card.short}</div>
          <div
            className="mg-caption"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            {card.origin}
          </div>
        </div>
        <ScoreGauge value={card.score} size={56} />
      </Stack>
      <Hairline style={{ margin: "16px 0" }} />
      <div className="mg-caption" style={{ color: "hsl(var(--muted-foreground))" }}>
        {forLabel}
      </div>
      <div className="mg-body-sm" style={{ fontWeight: 600, marginTop: 2 }}>
        {card.role}
      </div>
    </>
  );
}

export interface MatchingCardStackProps {
  cards?: MatchingCard[];
  forLabel?: string;
}

export function MatchingCardStack({
  cards = DEFAULT_MATCHING_CARDS,
  forLabel = "Pour",
}: MatchingCardStackProps = {}) {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const reducedMotion = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = mq.matches;
    const onChange = () => {
      reducedMotion.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  React.useEffect(() => {
    if (reducedMotion.current) return;
    const interval = setInterval(() => {
      setActiveIndex((i) => (i + 1) % cards.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [cards.length]);

  return (
    <>
      {/* Desktop: rotated stack */}
      <div className="relative hidden md:block" style={{ height: 360 }}>
        {cards.map((card, i) => {
          const pos = DESKTOP_POSITIONS[i];
          return (
            <Card
              key={card.name}
              elevation={2}
              style={{
                position: "absolute",
                top: pos.top,
                left: pos.left,
                right: pos.right,
                transform: `rotate(${pos.rotate}deg)`,
              }}
            >
              <CardBody card={card} forLabel={forLabel} />
            </Card>
          );
        })}
      </div>

      {/* Mobile: single card cross-fade */}
      <div className="md:hidden relative" style={{ minHeight: 180 }}>
        {cards.map((card, i) => (
          <div
            key={card.name}
            aria-hidden={i !== activeIndex}
            style={{
              position: i === 0 ? "relative" : "absolute",
              inset: i === 0 ? undefined : 0,
              opacity: i === activeIndex ? 1 : 0,
              transition: "opacity 400ms ease",
              pointerEvents: i === activeIndex ? "auto" : "none",
            }}
          >
            <Card elevation={2}>
              <CardBody card={card} forLabel={forLabel} />
            </Card>
          </div>
        ))}
      </div>
    </>
  );
}

export default MatchingCardStack;
