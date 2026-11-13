/**
 * Écran d'ouverture : monogramme NDOA, anneau doré qui se dessine, « NDOA WEDDING » lettre à lettre,
 * puis le rideau se lève sur la page. 100 % CSS (aucune attente réseau), < 2 s, une fois par visite :
 * le petit script ci-dessous le masque avant affichage si la visite l'a déjà montré.
 */
const SEEN = `try{if(sessionStorage.getItem("ndoa.intro")){var s=document.createElement("style");s.textContent=".intro{display:none!important}.intro~main .hero-inner>*{animation:none!important}";document.head.appendChild(s)}else sessionStorage.setItem("ndoa.intro","1")}catch(e){}`;

const WORD = "NDOA WEDDING";

export function Intro() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SEEN }} />
      <div className="intro" aria-hidden="true">
        <div className="intro-inner">
          <div className="intro-mark">
            <svg className="intro-ring" viewBox="0 0 120 120" focusable="false"><circle cx="60" cy="60" r="56" /></svg>
            {/* eslint-disable-next-line @next/next/no-img-element -- image minuscule, affichée avant l'hydratation */}
            <img src="/brand/ndoa-monogramme-ivoire.webp" alt="" width={256} height={223} fetchPriority="high" decoding="async" />
          </div>
          <p className="intro-word">
            {WORD.split("").map((c, i) => (
              <span key={i} style={{ "--i": i } as React.CSSProperties}>{c === " " ? " " : c}</span>
            ))}
          </p>
          <span className="intro-line" />
        </div>
      </div>
    </>
  );
}
