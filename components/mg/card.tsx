import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: keyof JSX.IntrinsicElements;
  padding?: number;
  surface?: 1 | 2 | 3;
  elevation?: 0 | 1 | 2;
  radius?: number;
}

export const Card = React.forwardRef<HTMLElement, CardProps>(function Card(
  {
    as,
    padding = 24,
    surface = 1,
    elevation = 1,
    radius = 8,
    style,
    children,
    ...rest
  },
  ref,
) {
  const bg =
    surface === 2 ? "hsl(var(--surface-2))" : surface === 3 ? "hsl(var(--surface-3))" : "hsl(var(--card))";
  const shadow =
    elevation === 0 ? "none" : elevation === 2 ? "var(--shadow-md)" : "var(--shadow-sm)";

  const Tag = (as ?? "div") as keyof JSX.IntrinsicElements;
  const Component = Tag as React.ElementType;

  return (
    <Component
      ref={ref as React.Ref<HTMLElement>}
      style={{
        background: bg,
        border: "1px solid hsl(var(--border))",
        borderRadius: radius,
        padding,
        boxShadow: shadow,
        color: "hsl(var(--card-foreground))",
        ...style,
      }}
      {...rest}
    >
      {children}
    </Component>
  );
});

export default Card;

// Optional sub-headings to keep import sites concise. Layout is just CSS — we
// keep them lightweight so consumers can still write `<Card>` flat content.
export function CardHeader({ children, style, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ children, style, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className="mg-h3" style={{ margin: 0, ...style }} {...rest}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, style, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className="mg-body-sm"
      style={{ margin: 0, color: "hsl(var(--muted-foreground))", ...style }}
      {...rest}
    >
      {children}
    </p>
  );
}

export function CardContent({ children, style, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div style={style} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ children, style, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
