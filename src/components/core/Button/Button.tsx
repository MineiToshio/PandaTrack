"use client";

import { buttonVariants } from "@/components/core/Button/buttonVariants";
import { cn } from "@/lib/styles";
import { VariantProps } from "class-variance-authority";
import { ButtonHTMLAttributes, forwardRef, useCallback, useRef, useState } from "react";

const RIPPLE_DURATION_MS = 600;

type Ripple = { id: number; x: number; y: number };

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size, type = "button", onClick, ...props }, ref) => {
    const internalRef = useRef<HTMLButtonElement>(null);
    const resolvedRef = (node: HTMLButtonElement | null) => {
      internalRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: HTMLButtonElement | null }).current = node;
    };

    const [ripples, setRipples] = useState<Ripple[]>([]);

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (variant === "primary") {
          const button = internalRef.current;
          if (button) {
            const rect = button.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const id = Date.now();
            setRipples((prev) => [...prev, { id, x, y }]);
            setTimeout(() => {
              setRipples((prev) => prev.filter((r) => r.id !== id));
            }, RIPPLE_DURATION_MS);
          }
        }
        onClick?.(e);
      },
      [variant, onClick],
    );

    const showRipple = variant === "primary";

    return (
      <button
        ref={resolvedRef}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        onClick={handleClick}
        {...props}
      >
        {showRipple &&
          ripples.map(({ id, x, y }) => (
            <span
              key={id}
              className="bg-primary-foreground/40 pointer-events-none absolute rounded-full"
              style={{
                left: x,
                top: y,
                width: 400,
                height: 400,
                transform: "translate(-50%, -50%)",
                animation: `button-ripple ${RIPPLE_DURATION_MS}ms ease-out forwards`,
              }}
              aria-hidden
            />
          ))}
        {props.children}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
