/** Remonté à chaque navigation : fondu d'entrée de page (opacité seule, pour ne pas gêner les éléments fixes) */
export default function MarketplaceTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
