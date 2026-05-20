import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { style, invalid, disabled, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      style={{
        height: 40,
        width: "100%",
        padding: "0 12px",
        background: "hsl(var(--background))",
        color: "hsl(var(--foreground))",
        border: `1px solid hsl(var(--${invalid ? "destructive" : "input"}))`,
        borderRadius: 8,
        fontSize: 14,
        fontFamily: "inherit",
        outline: "none",
        transition: "border-color .12s ease, box-shadow .12s ease",
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
      {...rest}
    />
  );
});

export default Input;
