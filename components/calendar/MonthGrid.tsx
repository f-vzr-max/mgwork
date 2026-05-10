"use client";

// Minimal month-grid calendar.
//
// Shows a 7-column grid for the given `month` (Date pinning the 1st of the
// month). Days from the previous and next month appear in muted form so the
// grid is always 6 rows. Each cell receives a list of items to render.
//
// We deliberately avoid an external calendar library — date-fns gives us
// every primitive we need, and rendering stays under 80 lines.

import * as React from "react";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";

export type CalendarItem = {
  id: string;
  date: Date;
  label: string;
  href?: string;
};

export type MonthGridProps = {
  month: Date;
  items: CalendarItem[];
  onSelectDay?: (day: Date) => void;
  selectedDay?: Date | null;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthGrid({
  month,
  items,
  onSelectDay,
  selectedDay,
}: MonthGridProps) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });

  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    days.push(d);
  }

  const itemsByDay = React.useMemo(() => {
    const byKey = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const k = format(item.date, "yyyy-MM-dd");
      const arr = byKey.get(k) ?? [];
      arr.push(item);
      byKey.set(k, arr);
    }
    return byKey;
  }, [items]);

  return (
    <div className="rounded-md border bg-card">
      <div className="grid grid-cols-7 border-b text-xs font-medium uppercase text-muted-foreground">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="px-2 py-2 text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const isCurrentMonth = isSameMonth(d, month);
          const isSelected = selectedDay ? isSameDay(d, selectedDay) : false;
          const dayItems = itemsByDay.get(format(d, "yyyy-MM-dd")) ?? [];
          return (
            <button
              type="button"
              key={d.toISOString()}
              onClick={() => onSelectDay?.(d)}
              className={cn(
                "flex min-h-[88px] flex-col items-stretch border-b border-r px-2 py-1 text-left text-xs transition-colors",
                !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                isSelected && "ring-2 ring-primary ring-inset",
                "hover:bg-accent/30",
              )}
            >
              <span
                className={cn(
                  "mb-1 text-[11px] font-medium",
                  !isCurrentMonth && "text-muted-foreground",
                )}
              >
                {format(d, "d")}
              </span>
              <ul className="flex flex-col gap-1">
                {dayItems.slice(0, 3).map((it) => (
                  <li
                    key={it.id}
                    className="truncate rounded bg-primary/10 px-1 py-[1px] text-[11px] text-primary"
                  >
                    {it.label}
                  </li>
                ))}
                {dayItems.length > 3 && (
                  <li className="text-[11px] text-muted-foreground">
                    +{dayItems.length - 3} more
                  </li>
                )}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}
