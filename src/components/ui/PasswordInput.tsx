"use client";

import { forwardRef, useState } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "./Button";
import { controlBase } from "./Field";
import { Icon } from "./Icon";

/** Senha com botão mostrar/ocultar (WCAG 3.3.8: conferir o que digitou sem depender de memória). */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input ref={ref} type={visible ? "text" : "password"} className={cn(controlBase, "h-10 pr-11", className)} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-controls={props.id}
          className={cn("absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-fg-muted hover:text-fg", focusRing)}
        >
          <Icon name={visible ? "eyeOff" : "eye"} />
        </button>
      </div>
    );
  },
);
