/** Repère doré de NDOA (goutte avec point), utilisé sur les cartes */
export function MapPin({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 32 40" aria-hidden="true" style={{ display: "block", translate: "0 -45%", filter: "drop-shadow(0 6px 8px rgba(0,0,0,.45))" }}>
      <path d="M16 39s13-13.2 13-23A13 13 0 0 0 3 16c0 9.8 13 23 13 23Z" fill="#C4975A" stroke="#0A0A0B" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="5.2" fill="#0A0A0B" />
    </svg>
  );
}
