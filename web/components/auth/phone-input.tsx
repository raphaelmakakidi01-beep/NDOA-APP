"use client";

import { COUNTRY_CODES } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { inputClass } from "@/components/ui/field";

/** Indicatif pays + numéro local, saisis séparément */
export function PhoneInput({
  id, country, onCountry, value, onChange, describedBy, invalid, placeholder = "81 234 5678",
}: {
  id: string; country: string; onCountry: (c: string) => void; value: string; onChange: (v: string) => void;
  describedBy?: string; invalid?: boolean; placeholder?: string;
}) {
  return (
    <div className="flex gap-2">
      <label className="sr-only" htmlFor={`${id}-cc`}>Indicatif pays</label>
      <select id={`${id}-cc`} value={country} onChange={(e) => onCountry(e.target.value)}
        className={cn(inputClass, "w-[104px] shrink-0 appearance-none px-3 text-center font-semibold")}>
        {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
      </select>
      <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^\d\s]/g, ""))}
        aria-describedby={describedBy} aria-invalid={invalid || undefined}
        className={inputClass} />
    </div>
  );
}
