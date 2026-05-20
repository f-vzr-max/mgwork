import * as React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { style, invalid, disabled, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      style={{
        minHeight: 96,
        width: "100%",
        padding: "10px 12px",
        background: "hsl(var(--background))",
        color: "hsl(var(--foreground))",
        border: `1px solid hsl(var(--${invalid ? "destructive" : "input"}))`,
        borderRadius: 8,
        fontSize: 14,
        fontFamily: "inherit",
        outline: "none",
        transition: "border-color .12s ease, box-shadow .12s ease",
        opacity: disabled ? 0.6 : 1,
        resize: "vertical",
        ...style,
      }}
      {...rest}
    />
  );
});

export default Textarea;
