"use client";

import imageCompression from "browser-image-compression";

/* Formats acceptés en production (les mêmes sont imposés par le stockage Supabase) */
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const VIDEO_TYPES = ["video/mp4"];
export const PHOTO_ACCEPT = ".jpg,.jpeg,.png,.webp," + PHOTO_TYPES.join(",");
export const MEDIA_ACCEPT = `${PHOTO_ACCEPT},.mp4,${VIDEO_TYPES.join(",")}`;
/** Taille avant compression ; après compression une photo pèse ≈ 1,5 Mo (le serveur refuse > 5 Mo) */
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

/** Le fichier choisi est-il une vidéo (quel que soit son format) ? */
export const isVideoFile = (file: File) => file.type.startsWith("video/") || /\.(mp4|m4v|mov|webm|avi|mkv|3gp)$/i.test(file.name);

/** Vérifie un fichier avant traitement ; renvoie un message d’erreur ou null */
export function checkPhoto(file: File): string | null {
  if (/\.(heic|heif)$/i.test(file.name) || /heic|heif/.test(file.type))
    return `« ${file.name} » est au format HEIC : exportez-la en JPEG depuis votre téléphone.`;
  if (!PHOTO_TYPES.includes(file.type)) return `« ${file.name} » n’est pas une photo JPEG, PNG ou WebP.`;
  if (file.size > MAX_PHOTO_BYTES) return `« ${file.name} » dépasse 15 Mo.`;
  return null;
}

/** Vidéos : MP4 uniquement (lisible partout, y compris sur iPhone et WhatsApp) */
export function checkVideo(file: File): string | null {
  if (!VIDEO_TYPES.includes(file.type) && !/\.mp4$/i.test(file.name))
    return `« ${file.name} » : seules les vidéos MP4 sont acceptées. Exportez-la en MP4 depuis votre téléphone ou votre logiciel de montage.`;
  return null;
}

/**
 * Vérifie la signature réelle du fichier (premiers octets) : un fichier renommé
 * en .jpg ou au type MIME falsifié est refusé avant tout envoi.
 * Le serveur revérifie le type stocké (trigger `verify_media_object`).
 */
export async function checkSignature(file: File, kind: "photo" | "video"): Promise<string | null> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  const isJpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isPng = b[0] === 0x89 && ascii(1, 4) === "PNG";
  const isWebp = ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  const ftyp = ascii(4, 8) === "ftyp" ? ascii(8, 12) : "";
  // conteneur MP4 (isom, mp41, mp42, avc1…), en excluant QuickTime (MOV) et les images HEIF/AVIF
  const isMp4 = !!ftyp && !/^(qt  |avi[fs]|hei[cfx]|mif1|msf1)$/.test(ftyp);
  const valid = kind === "photo" ? isJpeg || isPng || isWebp : isMp4;
  return valid ? null : `« ${file.name} » n’est pas ${kind === "photo" ? "une image valide" : "une vidéo valide"} (fichier corrompu ou renommé).`;
}

/**
 * Compresse et redimensionne dans le navigateur : WebP, 2 560 px max, ~1,5 Mo.
 * Le réencodage supprime les métadonnées EXIF (dont la position GPS).
 */
export async function compressPhoto(file: File, maxSide = 2560) {
  const blob = await imageCompression(file, {
    maxWidthOrHeight: maxSide,
    maxSizeMB: 1.5,
    fileType: "image/webp",
    initialQuality: 0.84,
    useWebWorker: true,
  });
  const dims = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(img.src); };
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = URL.createObjectURL(blob);
  });
  return { blob, ...dims };
}

/** Envoi avec progression (XHR) vers une URL d’envoi signée Supabase */
export function uploadWithProgress(url: string, blob: Blob, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", blob.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Réseau indisponible"));
    xhr.send(blob);
  });
}
