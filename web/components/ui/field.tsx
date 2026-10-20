"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* Champ de formulaire : libellé, aide, erreur, liaison ARIA automatique */
type FieldProps = {
  /** id du contrôle (sinon généré) */
  id?: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  counter?: { value: number; max: number };
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
};

export function Field({ id: idProp, label, hint, error, optional, className, counter, children }: FieldProps) {
  const autoId = React.useId();
  const id = idProp ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-text">
          {label}
          {optional && <span className="ml-1.5 font-normal text-muted">(facultatif)</span>}
        </label>
        {counter && (
          <span className={cn("text-xs tabular-nums", counter.value > counter.max ? "text-danger" : "text-muted")}>
            {counter.value} / {counter.max}
          </span>
        )}
      </div>
      {children({ id, describedBy, invalid: !!error })}
      {hint && !error && (
        <p id={hintId} className="text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "h-12 w-full rounded-xl border border-line-strong bg-surface px-4 text-[15px] text-text placeholder:text-muted/80 transition-colors focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 aria-[invalid=true]:border-danger";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(inputClass, className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(inputClass, "h-auto min-h-32 py-3 leading-relaxed", className)} {...props} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(inputClass, "appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10", className)}
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23C4975A' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")" }}
        {...props}>
        {children}
      </select>
    );
  },
);
