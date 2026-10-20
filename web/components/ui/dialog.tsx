"use client";

import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Fenêtre modale accessible (focus piégé, Échap, titre annoncé) ; en panneau bas sur mobile */
export function Dialog({
  open, onOpenChange, title, description, children, footer, className, wide,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; description?: React.ReactNode;
  children: React.ReactNode; footer?: React.ReactNode; className?: string; wide?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm data-[state=open]:animate-[fadeIn_.2s_ease-out]" />
        <D.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl border border-line bg-surface shadow-2xl outline-none",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl",
            wide ? "sm:max-w-3xl" : "sm:max-w-lg",
            "data-[state=open]:animate-[dialogIn_.28s_cubic-bezier(.22,1,.36,1)]",
            className,
          )}>
          <div className="flex items-start gap-4 border-b border-line px-6 py-5">
            <div className="flex-1">
              <D.Title className="font-display text-2xl leading-tight">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : <D.Description className="sr-only">{typeof title === "string" ? title : "Fenêtre"}</D.Description>}
            </div>
            <D.Close className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-muted hover:border-gold hover:text-text" aria-label="Fermer">
              <X className="size-4" aria-hidden />
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
