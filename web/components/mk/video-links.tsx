"use client";

import { useState } from "react";
import type { SocialLink } from "@/lib/public/types";
import { VIDEO_LINK_LABELS, type VideoLink } from "@/lib/vendor-extras";

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>
);

/** Lecteur léger : la vignette s'affiche, le lecteur YouTube/Vimeo ne se charge qu'au clic */
function Player({ v, name }: { v: Extract<VideoLink, { id: string }>; name: string }) {
  const [on, setOn] = useState(false);
  const src = v.kind === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`
    : `https://player.vimeo.com/video/${v.id}?autoplay=1&dnt=1`;
  if (on) return <iframe className="vl-frame" src={src} title={`Vidéo de ${name}`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />;
  return (
    <button type="button" className="vl-thumb" onClick={() => setOn(true)} aria-label={`Lire la vidéo ${VIDEO_LINK_LABELS[v.kind]} de ${name}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {v.kind === "youtube" && <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" loading="lazy" />}
      <span className="vl-play"><PlayIcon /></span>
      <span className="vl-src">{VIDEO_LINK_LABELS[v.kind]}</span>
    </button>
  );
}

/** Vidéastes et pilotes de drone : vidéos en ligne (lecteurs intégrés ou liens) et réseaux sociaux */
export function VideoLinks({ links, socials, name }: { links: VideoLink[]; socials: SocialLink[]; name: string }) {
  const players = links.filter((l): l is Extract<VideoLink, { id: string }> => l.kind === "youtube" || l.kind === "vimeo");
  const others = links.filter((l) => l.kind !== "youtube" && l.kind !== "vimeo");
  return (
    <div className="vl">
      {players.length > 0 && <div className="vl-grid">{players.map((v) => <Player key={v.url} v={v} name={name} />)}</div>}
      {(others.length > 0 || socials.length > 0) && (
        <div className="vl-links">
          {others.map((v) => (
            <a key={v.url} className="vl-link" href={v.url} target="_blank" rel="noopener noreferrer nofollow">
              <PlayIcon /><span>Voir la vidéo sur {VIDEO_LINK_LABELS[v.kind]}</span><span aria-hidden="true">↗</span>
            </a>
          ))}
          {socials.map((s) => (
            <a key={s.network} className="vl-link vl-social" href={s.url} target="_blank" rel="noopener noreferrer nofollow">
              <span>{s.label}</span><span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
