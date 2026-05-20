import * as React from "react";

const AVATAR_PALETTE: ReadonlyArray<readonly [string, string]> = [
  ["#1A3C6E", "#FFFFFF"],
  ["#007B55", "#FFFFFF"],
  ["#9A5E08", "#FFFFFF"],
  ["#1373B0", "#FFFFFF"],
  ["#5B3D8B", "#FFFFFF"],
  ["#B0463B", "#FFFFFF"],
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  size?: number;
  src?: string;
}

export function Avatar({
  name = "",
  size = 32,
  src,
  style,
  ...rest
}: AvatarProps) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const [bg, fg] = AVATAR_PALETTE[hashStr(name) % AVATAR_PALETTE.length]!;
  return (
    <div
      aria-hidden={!name || undefined}
      aria-label={name || undefined}
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        background: src ? `center/cover no-repeat url(${src}), ${bg}` : bg,
        color: fg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.4),
        fontWeight: 600,
        flex: "0 0 auto",
        ...style,
      }}
      {...rest}
    >
      {!src && initials}
    </div>
  );
}

export default Avatar;
