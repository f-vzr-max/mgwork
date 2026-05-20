import * as React from "react";

// Minimal lucide-style icon subset shipped with the MG design system.
// Each entry is the path data; multiple sub-paths are joined with " M " in the
// source string and split at render time so a single icon can express multiple
// disconnected strokes (e.g. notifications, sliders).
const ICONS: Record<string, string> = {
  "check-circle-2":
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 Z M9 12l2 2 4-4",
  "alert-triangle":
    "M12 9v4 M12 17h.01 M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z",
  "octagon-alert":
    "M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86L7.86 2Z M12 8v4 M12 16h.01",
  "circle-dot":
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 6v6l4 2",
  "circle-dashed":
    "M10.1 2.18a9.93 9.93 0 0 1 3.8 0 M17.6 3.71a9.95 9.95 0 0 1 2.69 2.7 M21.82 10.1a9.93 9.93 0 0 1 0 3.8 M20.29 17.6a9.95 9.95 0 0 1-2.7 2.69 M13.9 21.82a9.94 9.94 0 0 1-3.8 0 M6.4 20.29a9.95 9.95 0 0 1-2.69-2.7 M2.18 13.9a9.94 9.94 0 0 1 0-3.8 M3.71 6.4a9.95 9.95 0 0 1 2.7-2.69",
  "chevron-right": "m9 18 6-6-6-6",
  "chevron-left": "m15 18-6-6 6-6",
  "chevron-down": "m6 9 6 6 6-6",
  "chevron-up": "m18 15-6-6-6 6",
  "arrow-right": "M5 12h14 m-7-7 7 7-7 7",
  "arrow-up-right": "M7 7h10v10 M7 17 17 7",
  "arrow-up": "m5 12 7-7 7 7 M12 19V5",
  "arrow-down": "M12 5v14 m-7-7 7 7 7-7",
  search: "M21 21l-4.34-4.34 M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z",
  bell:
    "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0",
  menu: "M4 12h16 M4 6h16 M4 18h16",
  plus: "M5 12h14 M12 5v14",
  x: "M18 6 6 18 M6 6l12 12",
  send: "M22 2 11 13 M22 2l-7 20-4-9-9-4 20-7Z",
  paperclip:
    "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57a4 4 0 1 1 5.66 5.66l-8.58 8.57a2 2 0 1 1-2.83-2.83l8.49-8.48",
  home: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z M9 22V12h6v10",
  "file-text":
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  briefcase:
    "M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16 M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z",
  "message-circle":
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 Z M3 12c0 5 4 9 9 9 1.5 0 3-.5 4-1l4 1-1-4c.5-1 1-2.5 1-4",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  sliders:
    "M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M2 14h4 M10 8h4 M18 16h4",
  globe:
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z",
  "shield-check": "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z m-3-12 2 2 4-4",
  eye:
    "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  "more-vertical":
    "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2 Z M12 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2 Z M12 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2 Z",
  "more-horizontal":
    "M13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z M20 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z M6 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
  "book-user":
    "M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z M15 13a3 3 0 1 0-6 0 M17 19c-1-2-3-3-5-3s-4 1-5 3",
  stethoscope:
    "M11 2v2 M5 2v2 M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1 M8 15a6 6 0 0 0 12 0v-3 M20 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  stamp:
    "M5 22h14 M19 14h-2v-3a2 2 0 0 0-2-2h-1V5a3 3 0 1 0-6 0v4H7a2 2 0 0 0-2 2v3H3v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4Z",
  "building-2":
    "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2 M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2 M10 6h4 M10 10h4 M10 14h4 M10 18h4",
  mail:
    "M22 6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2 m20 0v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6 m20 0-10 7L2 6",
  "map-pin":
    "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  calendar:
    "M8 2v4 M16 2v4 M3 10h18 M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z",
  star:
    "m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z",
  sparkles:
    "m12 3-1.5 4.5L6 9l4.5 1.5L12 15l1.5-4.5L18 9l-4.5-1.5L12 3Z M5 17l-1 3-3 1 3 1 1 3 1-3 3-1-3-1-1-3Z M19 14l-.7 2.1-2.1.7 2.1.7.7 2.1.7-2.1 2.1-.7-2.1-.7-.7-2.1Z",
  circle: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z",
  filter: "M22 3H2l8 9.46V19l4 2v-8.54L22 3Z",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  sun:
    "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42",
  moon: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z",
  monitor:
    "M20 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z M8 21h8 M12 17v4",
  "logo-dot": "M12 12 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0-6 0",
};

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName | string;
  size?: number;
  stroke?: number;
  style?: React.CSSProperties;
  className?: string;
  "aria-label"?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

export function Icon({ name, size = 16, stroke = 1.5, style, className, ...rest }: IconProps) {
  const d = ICONS[name as keyof typeof ICONS];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={rest["aria-label"] ? undefined : "true"}
      aria-label={rest["aria-label"]}
      className={className}
      style={{ flex: "0 0 auto", display: "block", ...style }}
    >
      {d.split(" M ").map((part, i) => (
        <path key={i} d={i === 0 ? part : "M " + part} />
      ))}
    </svg>
  );
}

export default Icon;
