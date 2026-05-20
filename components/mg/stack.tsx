import * as React from "react";

export interface StackProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "dir"> {
  dir?: "row" | "column";
  gap?: number | string;
  align?: React.CSSProperties["alignItems"];
  justify?: React.CSSProperties["justifyContent"];
  wrap?: boolean;
  inline?: boolean;
  as?: keyof JSX.IntrinsicElements;
}

export function Stack({
  dir = "column",
  gap = 8,
  align,
  justify,
  wrap,
  inline,
  style,
  children,
  as,
  ...rest
}: StackProps) {
  const Tag = (as ?? "div") as keyof JSX.IntrinsicElements;
  const Component = Tag as React.ElementType;
  return (
    <Component
      style={{
        display: inline ? "inline-flex" : "flex",
        flexDirection: dir,
        gap,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? "wrap" : "nowrap",
        ...style,
      }}
      {...rest}
    >
      {children}
    </Component>
  );
}

export default Stack;
