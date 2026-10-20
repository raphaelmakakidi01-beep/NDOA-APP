"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getUser, type SessionUser } from "@/lib/auth";
import { checkPhoto, checkSignature, compressPhoto } from "@/lib/media";
import { toFieldErrors, type FieldErrors } from "@/lib/validation";
import { uid } from "@/lib/utils";
import { DEMO_AVATAR, DEMO_PHOTOS, U } from "./catalog";
import { cacheDraft, forgetImage, loadDraft, persistStep, publish as publishRepo, storeImage } from "./repo";
import { validateStep } from "./rules";
import { STEPS, type Draft, type MediaRef, type StepKey } from "./types";

type Ctx = {
  user: SessionUser;
  draft: Draft;
  update: (patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => void;
  errors: FieldErrors;
  setErrors: (e: FieldErrors) => void;
  saving: boolean;
  /** Valide l’étape, l’enregistre et passe à la suivante */
  submitStep: (step: StepKey) => Promise<boolean>;
  addPhotos: (files: FileList | File[], target?: "photos" | "cover") => Promise<void>;
  setAvatar: (file: File) => Promise<void>;
  removePhoto: (id: string) => void;
  setCover: (id: string) => void;
  movePhoto: (id: string, dir: -1 | 1) => void;
  addDemoPhotos: () => void;
  publish: () => Promise<boolean>;
};

const OnboardingContext = React.createContext<Ctx | null>(null);
const ReadyContext = React.createContext(false);
/** Vrai quand la session et le brouillon sont chargés */
export const useOnboardingReady = () => React.useContext(ReadyContext);
export const useOnboarding = () => {
  const ctx = React.useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding doit être utilisé dans OnboardingProvider");
  return ctx;
};

/**
 * `page` est toujours rendu (même avant le chargement) pour que Next puisse prérendre le segment ;
 * les composants de page attendent `useOnboardingReady()` avant d’utiliser le contexte.
 */
export function OnboardingProvider({ children, fallback, page }: { children: React.ReactNode; fallback: React.ReactNode; page: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [saving, setSaving] = React.useState(false);
  const draftRef = React.useRef<Draft | null>(null);
  // dernière version du brouillon pour les actions asynchrones
  React.useLayoutEffect(() => { draftRef.current = draft; });

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const u = await getUser();
      if (!alive) return;
      if (!u) { router.replace(`/connexion?suite=${encodeURIComponent(location.pathname)}`); return; }
      const d = await loadDraft(u.id);
      if (!alive) return;
      setUser(u);
      setDraft(d);
    })();
    return () => { alive = false; };
  }, [router]);

  // Sauvegarde locale automatique (reprise après fermeture de l’onglet)
  React.useEffect(() => {
    if (!user || !draft) return;
    const t = setTimeout(() => cacheDraft(user.id, draft), 400);
    return () => clearTimeout(t);
  }, [user, draft]);

  /** Retire les erreurs des champs qui viennent de changer (elles réapparaîtront au prochain envoi si besoin) */
  const clearErrorsFor = React.useCallback((keys: string[]) => {
    setErrors((e) => {
      if (!keys.some((k) => e[k])) return e;
      const next = { ...e };
      keys.forEach((k) => delete next[k]);
      return next;
    });
  }, []);

  const update = React.useCallback<Ctx["update"]>((patch) => {
    setDraft((d) => {
      if (!d) return d;
      const p = typeof patch === "function" ? patch(d) : patch;
      const keys = Object.keys(p);
      if (p.pkg) keys.push(...Object.keys(p.pkg).filter((k) => p.pkg![k as keyof Draft["pkg"]] !== d.pkg[k as keyof Draft["pkg"]]));
      if (p.contacts) keys.push(...Object.keys(p.contacts).filter((k) => p.contacts![k as keyof Draft["contacts"]] !== d.contacts[k as keyof Draft["contacts"]]));
      queueMicrotask(() => clearErrorsFor(keys));
      return { ...d, ...p };
    });
  }, [clearErrorsFor]);

  const patchMedia = React.useCallback((id: string, p: Partial<MediaRef>) => {
    setDraft((d) => {
      if (!d) return d;
      const fix = (m?: MediaRef) => (m && m.id === id ? { ...m, ...p } : m);
      return { ...d, avatar: fix(d.avatar), cover: fix(d.cover), photos: d.photos.map((m) => fix(m)!) };
    });
  }, []);

  const processOne = React.useCallback(
    async (file: File, kind: "photo" | "cover" | "avatar") => {
      const badFile = await checkSignature(file, "photo");
      if (badFile) { toast.error(badFile); return; }
      const tempId = uid();
      const placeholder: MediaRef = { id: tempId, url: "", source: "local", name: file.name, size: file.size, status: "uploading", progress: 3 };
      setDraft((d) => {
        if (!d) return d;
        if (kind === "photo") return { ...d, photos: [...d.photos, placeholder] };
        if (kind === "cover") return { ...d, cover: placeholder };
        return { ...d, avatar: placeholder };
      });
      try {
        const processed = await compressPhoto(file, kind === "avatar" ? 800 : 2560);
        patchMedia(tempId, { progress: 30, url: URL.createObjectURL(processed.blob) });
        const ref = await storeImage(
          { vendorId: draftRef.current?.vendorId },
          { ...processed, name: file.name },
          (p) => patchMedia(tempId, { progress: 30 + Math.round(p * 0.7) }),
          kind,
        );
        setDraft((d) => {
          if (!d) return d;
          if (kind === "photo") return { ...d, photos: d.photos.map((m) => (m.id === tempId ? ref : m)) };
          if (kind === "cover") return { ...d, cover: ref };
          return { ...d, avatar: ref };
        });
        clearErrorsFor([kind === "photo" ? "photos" : kind]);
      } catch (e) {
        patchMedia(tempId, { status: "error", progress: 0, error: e instanceof Error ? e.message : "Échec de l’envoi." });
      }
    },
    [patchMedia, clearErrorsFor],
  );

  const addPhotos = React.useCallback<Ctx["addPhotos"]>(
    async (files, target = "photos") => {
      const list = Array.from(files);
      const rejected = list.map(checkPhoto).filter(Boolean) as string[];
      rejected.forEach((msg) => toast.error(msg));
      const ok = list.filter((f) => !checkPhoto(f));
      if (target === "cover" && ok[0]) return processOne(ok[0], "cover");
      // 3 envois en parallèle pour ménager les connexions mobiles
      const queue = [...ok];
      await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
        while (queue.length) await processOne(queue.shift()!, "photo");
      }));
    },
    [processOne],
  );

  const setAvatar = React.useCallback<Ctx["setAvatar"]>(async (file) => {
    const err = checkPhoto(file);
    if (err) { toast.error(err); return; }
    await processOne(file, "avatar");
  }, [processOne]);

  const removePhoto = React.useCallback((id: string) => {
    const d = draftRef.current;
    const m = d?.photos.find((p) => p.id === id) ?? (d?.cover?.id === id ? d.cover : undefined);
    if (m) void forgetImage(m);
    update((x) => ({ photos: x.photos.filter((p) => p.id !== id), cover: x.cover?.id === id ? undefined : x.cover }));
  }, [update]);

  const setCover = React.useCallback((id: string) => {
    update((x) => {
      const m = x.photos.find((p) => p.id === id);
      return m ? { cover: m } : {};
    });
    toast.success("Photo de couverture mise à jour");
  }, [update]);

  const movePhoto = React.useCallback((id: string, dir: -1 | 1) => {
    update((x) => {
      const i = x.photos.findIndex((p) => p.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= x.photos.length) return {};
      const photos = [...x.photos];
      [photos[i], photos[j]] = [photos[j], photos[i]];
      return { photos };
    });
  }, [update]);

  const addDemoPhotos = React.useCallback(() => {
    const remote = (id: string, name: string): MediaRef => ({ id: uid(), url: U(id, 1400), source: "remote", name, size: 420_000, status: "ready", progress: 100 });
    update((x) => ({
      photos: [...x.photos, ...DEMO_PHOTOS.map((p, i) => remote(p, `realisation-${i + 1}.webp`))],
      cover: x.cover ?? remote(DEMO_PHOTOS[0], "couverture.webp"),
      avatar: x.avatar ?? remote(DEMO_AVATAR, "profil.webp"),
    }));
    toast.success("8 photos de démonstration ajoutées");
  }, [update]);

  const submitStep = React.useCallback<Ctx["submitStep"]>(async (step) => {
    const d = draftRef.current;
    if (!d || !user) return false;
    const res = validateStep(step, d);
    if (!res.success) {
      const errs = "error" in res && res.error ? toFieldErrors(res.error) : {};
      setErrors(errs);
      toast.error("Quelques informations sont à compléter.", { description: Object.values(errs)[0] });
      requestAnimationFrame(() => (document.querySelector("[aria-invalid=true], [data-error=true]") as HTMLElement | null)?.focus());
      return false;
    }
    if (d.photos.some((p) => p.status === "uploading")) { toast("Patientez, des photos sont encore en cours d’envoi."); return false; }
    setErrors({});
    setSaving(true);
    const out = await persistStep(user.id, step, { ...d, done: { ...d.done, [step]: true } });
    setSaving(false);
    if (!out.ok) { toast.error(out.error); return false; }
    setDraft(out.draft);
    const idx = STEPS.findIndex((s) => s.key === step);
    const next = STEPS[idx + 1];
    if (next) router.push(`/onboarding/${next.key}`);
    return true;
  }, [user, router]);

  const publish = React.useCallback(async () => {
    const d = draftRef.current;
    if (!d) return false;
    setSaving(true);
    const out = await publishRepo(d);
    setSaving(false);
    if (!out.ok) { toast.error(out.error); return false; }
    setDraft(out.draft);
    return true;
  }, []);

  if (!user || !draft) return <ReadyContext.Provider value={false}>{fallback}{page}</ReadyContext.Provider>;
  return (
    <ReadyContext.Provider value={true}>
    <OnboardingContext.Provider value={{ user, draft, update, errors, setErrors, saving, submitStep, addPhotos, setAvatar, removePhoto, setCover, movePhoto, addDemoPhotos, publish }}>
      {children}
    </OnboardingContext.Provider>
    </ReadyContext.Provider>
  );
}
