import * as React from "react";

export interface HairlineProps extends React.HTMLAttributes<HTMLDivElement> {
  vertical?: boolean;
}

export function Hairline({ vertical = false, style, ...rest }: HairlineProps) {
  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      className={vertical ? "mg-vhairline" : "mg-hairline"}
      style={style}
      {...rest}
    />
  );
}

export default Hairline;
