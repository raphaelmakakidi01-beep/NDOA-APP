"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/auth";

export function GoogleButton({ next = "/onboarding" }: { next?: string | (() => string) }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="w-full"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const r = await signInWithGoogle(typeof next === "function" ? next() : next);
        if (!r.ok) { toast.error(r.error); setBusy(false); return; }
        if ("redirectTo" in r && r.redirectTo) router.push(r.redirectTo);
      }}
    >
      {!busy && (
        <svg viewBox="0 0 24 24" aria-hidden className="size-[18px]">
          <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.4-1.6 4-5.4 4-3.3 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z" />
        </svg>
      )}
      Continuer avec Google
    </Button>
  );
}

export function OrSeparator() {
  return (
    <div className="my-1 flex items-center gap-4 text-xs font-semibold uppercase tracking-[.16em] text-muted" role="separator">
      <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
    </div>
  );
}
