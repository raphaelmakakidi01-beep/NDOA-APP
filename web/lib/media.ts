"use client";

import imageCompression from "browser-image-compression";

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

/** Vérifie un fichier avant traitement ; renvoie un message d’erreur ou null */
export function checkPhoto(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type) && !/\.(heic|heif)$/i.test(file.name))
    return `« ${file.name} » n’est pas une photo (JPEG, PNG, WebP ou AVIF).`;
  if (/\.(heic|heif)$/i.test(file.name)) return `« ${file.name} » est au format HEIC : exportez-la en JPEG depuis votre téléphone.`;
  if (file.size > MAX_PHOTO_BYTES) return `« ${file.name} » dépasse 15 Mo.`;
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
  const isAvif = ftyp === "avif" || ftyp === "avis";
  const isMp4 = !!ftyp && !isAvif; // mp4, isom, qt (MOV), M4V…
  const isWebm = b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
  const valid = kind === "photo" ? isJpeg || isPng || isWebp || isAvif : isMp4 || isWebm;
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
