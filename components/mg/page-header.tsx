import * as React from "react";

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div
      style={{
        padding: "24px 32px 16px",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h2 className="mg-h2" style={{ margin: 0 }}>
          {title}
        </h2>
        {subtitle && (
          <div className="mg-body-sm" style={{ color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
            {subtitle}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

export default PageHeader;
