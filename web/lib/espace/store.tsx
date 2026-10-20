"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getUser, type SessionUser } from "@/lib/auth";
import { checkPhoto, checkSignature, checkVideo, compressPhoto, isVideoFile } from "@/lib/media";
import { getSupabase } from "@/lib/supabase/client";
import { cacheDraft, loadDraft } from "@/lib/onboarding/repo";
import { emptyDraft, type Draft } from "@/lib/onboarding/types";
import { uid, formatBytes } from "@/lib/utils";
import { cacheEspace, forgetBlob, loadDemoEspace, loadFromDb, probeVideo, putBlob, remote } from "./repo";
import { PLANS, type Album, type EspaceData, type MediaItem, type Notification, type Story } from "./types";

type Status = "loading" | "error" | "ready";

type Ctx = {
  user: SessionUser;
  vendor: Draft;
  data: EspaceData;
  /** Données vides (démo ?demo=vide) */
  isEmpty: boolean;
  usage: { photos: number; videos: number; bytes: number };
  saveVitrine: (next: Draft) => Promise<boolean>;
  upload: (files: FileList | File[], albumId?: string) => void;
  updateMedia: (id: string, patch: Partial<MediaItem>) => void;
  replacePhoto: (id: string, blob: Blob, width: number, height: number) => Promise<void>;
  deleteMedia: (ids: string[]) => void;
  reorder: (ids: string[]) => void;
  saveAlbum: (a: Omit<Album, "id" | "createdAt"> & { id?: string }) => Album;
  deleteAlbum: (id: string) => void;
  saveStory: (s: Omit<Story, "id" | "createdAt"> & { id?: string }) => void;
  deleteStory: (id: string) => void;
  markAllRead: () => void;
  /** Mise à jour libre des données (utilisée par lib/espace/business.ts) */
  patch: (fn: (d: EspaceData) => EspaceData) => void;
  /** Demandes dont le couple est en train d’écrire (démo et temps réel) */
  typing: Record<string, boolean>;
  setTyping: (id: string, on: boolean) => void;
  /** Mise à jour du compte connecté (Paramètres) */
  setUser: (u: SessionUser) => void;
};

const EspaceContext = React.createContext<Ctx | null>(null);
const StatusContext = React.createContext<{ status: Status; retry: () => void }>({ status: "loading", retry: () => {} });

export const useEspace = () => {
  const c = React.useContext(EspaceContext);
  if (!c) throw new Error("useEspace doit être utilisé dans EspaceProvider");
  return c;
};
export const useEspaceStatus = () => React.useContext(StatusContext);
/** Contexte facultatif (null pendant le chargement) — pour la coque */
export const useEspaceMaybe = () => React.useContext(EspaceContext);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function EspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<Status>("loading");
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [vendor, setVendor] = React.useState<Draft | null>(null);
  const [data, setData] = React.useState<EspaceData | null>(null);
  const [isEmpty, setIsEmpty] = React.useState(false);
  const [attempt, setAttempt] = React.useState(0);
  const [typing, setTypingState] = React.useState<Record<string, boolean>>({});
  const setTyping = React.useCallback((id: string, on: boolean) => setTypingState((t) => ({ ...t, [id]: on })), []);
  const ref = React.useRef<{ data: EspaceData | null; vendor: Draft | null }>({ data: null, vendor: null });
  React.useLayoutEffect(() => { ref.current = { data, vendor }; });

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const u = await getUser();
      if (!alive) return;
      if (!u) { router.replace(`/connexion?suite=${encodeURIComponent(location.pathname)}`); return; }
      const mode = new URLSearchParams(location.search).get("demo");
      try {
        if (getSupabase()) {
          const res = await loadFromDb(u.id, u.email);
          if (!res) { router.replace("/onboarding"); return; }
          if (!alive) return;
          setVendor({ ...emptyDraft(), ...res.draft, done: { activite: true, entreprise: true, photos: true, tarif: true, contacts: true } });
          setData(res.data);
        } else {
          await wait(450); // laisse voir les squelettes, comme sur un vrai réseau
          if (mode === "erreur" && attempt === 0) throw new Error("demo");
          const d = await loadDraft(u.id);
          if (!d.publishedAt) { router.replace("/onboarding"); return; }
          const e = await loadDemoEspace(u.id, d, mode === "vide");
          if (!alive) return;
          setVendor(d);
          setData(e);
          setIsEmpty(mode === "vide");
        }
        setUser(u);
        setStatus("ready");
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => { alive = false; };
  }, [router, attempt]);

  // Sauvegarde locale automatique (mode démo, hors jeu de données vide)
  React.useEffect(() => {
    if (!user || !data || isEmpty || getSupabase()) return;
    const t = setTimeout(() => cacheEspace(user.id, data), 400);
    return () => clearTimeout(t);
  }, [user, data, isEmpty]);

  // Notifications en temps réel (Supabase Realtime) ; simulées en démo
  React.useEffect(() => {
    if (!user || status !== "ready") return;
    const push = (n: Notification) => {
      setData((d) => (d ? { ...d, notifications: [n, ...d.notifications] } : d));
      toast(n.title, { description: n.body, action: { label: "Voir", onClick: () => router.push(n.link) } });
    };
    const sb = getSupabase();
    if (sb) {
      const ch = sb.channel(`notif-${user.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (p) => {
          const r = p.new as Record<string, string>;
          push({ id: r.id, type: r.type as Notification["type"], title: r.title, body: r.body, link: r.link ?? "/espace", read: false, createdAt: r.created_at });
        })
        // nouveaux messages des mariés (la RLS ne laisse passer que ceux de nos demandes)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
          const r = p.new as Record<string, string>;
          if (r.sender === "vendor") return;
          setData((d) => (d && !d.messages.some((m) => m.id === r.id) ? {
            ...d,
            messages: [...d.messages, { id: r.id, inquiryId: r.inquiry_id, sender: r.sender as "couple", body: r.body ?? "", quoteId: r.quote_id ?? undefined, createdAt: r.created_at }],
            inquiries: d.inquiries.map((q) => (q.id === r.inquiry_id ? { ...q, unread: true } : q)),
          } : d));
        })
        .subscribe();
      return () => { void sb.removeChannel(ch); };
    }
    if (isEmpty || sessionStorage.getItem("eclat.demo.live")) return;
    const t = setTimeout(() => {
      sessionStorage.setItem("eclat.demo.live", "1");
      push({ id: uid(), type: "new_inquiry", title: "Nouvelle demande de devis", body: "Rachel & Héritier · mariage le 14 février", link: "/espace/demandes", read: false, createdAt: new Date().toISOString() });
    }, 20_000);
    return () => clearTimeout(t);
  }, [user, status, isEmpty, router]);

  const patchData = React.useCallback((fn: (d: EspaceData) => EspaceData) => setData((d) => (d ? fn(d) : d)), []);
  const patchItem = React.useCallback((id: string, p: Partial<MediaItem>) => patchData((d) => ({ ...d, media: d.media.map((m) => (m.id === id ? { ...m, ...p } : m)) })), [patchData]);

  const usage = React.useMemo(() => {
    const ok = (data?.media ?? []).filter((m) => m.status !== "error");
    return { photos: ok.filter((m) => m.kind === "photo").length, videos: ok.filter((m) => m.kind === "video").length, bytes: ok.reduce((s, m) => s + m.size, 0) };
  }, [data?.media]);

  const upload = React.useCallback<Ctx["upload"]>((files, albumId) => {
    const d = ref.current.data;
    if (!d) return;
    const plan = PLANS[d.plan];
    let photos = d.media.filter((m) => m.kind === "photo" && m.status !== "error").length;
    let videos = d.media.filter((m) => m.kind === "video" && m.status !== "error").length;
    let bytes = d.media.reduce((s, m) => s + m.size, 0);
    const queue: { file: File; kind: "photo" | "video" }[] = [];

    for (const file of Array.from(files)) {
      const isVideo = isVideoFile(file);
      if (isVideo) {
        const bad = checkVideo(file);
        if (bad) { toast.error(bad); continue; }
        if (!plan.maxVideos) { toast.error("Les vidéos sont disponibles à partir de l’offre Pro.", { action: { label: "Voir les offres", onClick: () => router.push("/espace/abonnement") } }); continue; }
        if (videos >= plan.maxVideos) { toast.error(`Limite de ${plan.maxVideos} vidéos atteinte pour l’offre ${plan.name}.`); continue; }
        if (file.size > plan.maxVideoMb * 1024 * 1024) { toast.error(`« ${file.name} » dépasse ${plan.maxVideoMb} Mo.`); continue; }
        videos++;
      } else {
        const err = checkPhoto(file);
        if (err) { toast.error(err); continue; }
        if (photos >= plan.maxPhotos) { toast.error(`Limite de ${plan.maxPhotos} photos atteinte pour l’offre ${plan.name}.`, { action: { label: "Passer à l’offre supérieure", onClick: () => router.push("/espace/abonnement") } }); break; }
        photos++;
      }
      if (bytes + file.size > plan.storageMb * 1024 * 1024 * (isVideo ? 1 : 3)) { toast.error("Espace de stockage plein."); break; }
      bytes += isVideo ? file.size : file.size / 3;
      queue.push({ file, kind: isVideo ? "video" : "photo" });
    }
    if (!queue.length) return;

    const items = queue.map(({ file, kind }) => ({
      file, item: { id: uid(), kind, url: "", source: "local", name: file.name, size: file.size, albumId, featured: false, alt: "", status: "uploading", progress: 2, createdAt: new Date().toISOString() } as MediaItem,
    }));
    patchData((x) => ({ ...x, media: [...items.map((i) => i.item), ...x.media] }));

    let okCount = 0;
    const work = async ({ file, item }: (typeof items)[number]) => {
      try {
        const badFile = await checkSignature(file, item.kind);
        if (badFile) throw new Error(badFile);
        let blob: Blob = file, width: number | undefined, height: number | undefined, duration: number | undefined, poster: Blob | null = null;
        if (item.kind === "photo") {
          patchItem(item.id, { status: "processing", progress: 8 });
          const c = await compressPhoto(file);
          ({ blob, width, height } = c);
          patchItem(item.id, { url: URL.createObjectURL(blob), progress: 30, status: "uploading" });
        } else {
          const p = await probeVideo(file);
          ({ duration, width, height, poster } = p);
          patchItem(item.id, { posterUrl: poster ? URL.createObjectURL(poster) : undefined, duration, progress: 20 });
        }
        const done = await remote.upload(ref.current.vendor?.vendorId, item.id, item.kind, blob, (pr) => patchItem(item.id, { progress: 30 + Math.round(pr * 0.7) }), { width, height, duration, poster, albumId });
        if (!done) {
          await putBlob(item.id, blob);
          if (poster) await putBlob(item.id, poster, true);
          for (let pr = 40; pr <= 100; pr += 15) { patchItem(item.id, { progress: pr }); await wait(80); }
        }
        okCount++;
        patchItem(item.id, {
          status: "ready", progress: 100, size: blob.size, width, height, duration, source: done ? "remote" : "local",
          url: done?.url ?? URL.createObjectURL(blob), posterUrl: done?.posterUrl ?? (poster ? URL.createObjectURL(poster) : undefined),
        });
      } catch (e) {
        patchItem(item.id, { status: "error", progress: 0, error: e instanceof Error ? e.message : "Échec de l’envoi." });
      }
    };
    const list = [...items];
    void Promise.all(Array.from({ length: Math.min(3, list.length) }, async () => { while (list.length) await work(list.shift()!); })).then(() => {
      const ok = okCount;
      if (ok) toast.success(ok > 1 ? `${ok} fichiers ajoutés` : "Fichier ajouté", { description: `Compressés automatiquement · ${formatBytes(items.reduce((s, i) => s + i.file.size, 0))} envoyés` });
    });
  }, [patchData, patchItem, router]);

  const updateMedia = React.useCallback<Ctx["updateMedia"]>((id, p) => { patchItem(id, p); void remote.updateMedia(id, p); }, [patchItem]);

  const replacePhoto = React.useCallback<Ctx["replacePhoto"]>(async (id, blob, width, height) => {
    const url = await remote.replacePhoto(ref.current.vendor?.vendorId, id, blob, width, height);
    if (!url) await putBlob(id, blob);
    patchItem(id, { url: url ?? URL.createObjectURL(blob), size: blob.size, width, height, source: url ? "remote" : "local" });
  }, [patchItem]);

  const deleteMedia = React.useCallback<Ctx["deleteMedia"]>((ids) => {
    const d = ref.current.data;
    if (!d) return;
    const removed = d.media.filter((m) => ids.includes(m.id));
    patchData((x) => ({
      ...x,
      media: x.media.filter((m) => !ids.includes(m.id)),
      stories: x.stories.map((s) => ({ ...s, mediaIds: s.mediaIds.filter((m) => !ids.includes(m)) })).filter((s) => s.mediaIds.length),
      albums: x.albums.map((a) => (a.coverId && ids.includes(a.coverId) ? { ...a, coverId: undefined } : a)),
    }));
    removed.forEach((m) => { void forgetBlob(m.id); void remote.deleteMedia(m); });
  }, [patchData]);

  const reorder = React.useCallback<Ctx["reorder"]>((ids) => {
    patchData((x) => ({ ...x, media: ids.map((id) => x.media.find((m) => m.id === id)!).filter(Boolean).concat(x.media.filter((m) => !ids.includes(m.id))) }));
    void remote.reorder(ids);
  }, [patchData]);

  const saveAlbum = React.useCallback<Ctx["saveAlbum"]>((a) => {
    const album: Album = { createdAt: new Date().toISOString(), ...a, id: a.id ?? uid() } as Album;
    patchData((x) => ({ ...x, albums: x.albums.some((y) => y.id === album.id) ? x.albums.map((y) => (y.id === album.id ? album : y)) : [...x.albums, album] }));
    void remote.upsertAlbum(ref.current.vendor?.vendorId, album);
    return album;
  }, [patchData]);

  const deleteAlbum = React.useCallback((id: string) => {
    patchData((x) => ({ ...x, albums: x.albums.filter((a) => a.id !== id), media: x.media.map((m) => (m.albumId === id ? { ...m, albumId: undefined } : m)) }));
    void remote.deleteAlbum(id);
  }, [patchData]);

  const saveStory = React.useCallback<Ctx["saveStory"]>((s) => {
    const story: Story = { createdAt: new Date().toISOString(), ...s, id: s.id ?? uid() } as Story;
    patchData((x) => ({ ...x, stories: x.stories.some((y) => y.id === story.id) ? x.stories.map((y) => (y.id === story.id ? story : y)) : [story, ...x.stories] }));
    void remote.upsertStory(ref.current.vendor?.vendorId, story);
  }, [patchData]);

  const deleteStory = React.useCallback((id: string) => { patchData((x) => ({ ...x, stories: x.stories.filter((s) => s.id !== id) })); void remote.deleteStory(id); }, [patchData]);

  const markAllRead = React.useCallback(() => {
    const ids = ref.current.data?.notifications.filter((n) => !n.read).map((n) => n.id) ?? [];
    patchData((x) => ({ ...x, notifications: x.notifications.map((n) => ({ ...n, read: true })) }));
    void remote.markNotificationsRead(ids);
  }, [patchData]);

  const saveVitrine = React.useCallback(async (next: Draft) => {
    const r = await remote.saveVitrine(next);
    if (!r.ok) { toast.error(r.error); return false; }
    if (!getSupabase()) await wait(400);
    setVendor(next);
    if (user) cacheDraft(user.id, next);
    return true;
  }, [user]);

  const statusValue = React.useMemo(() => ({ status, retry: () => { setStatus("loading"); setAttempt((a) => a + 1); } }), [status]);

  return (
    <StatusContext.Provider value={statusValue}>
      {status === "ready" && user && vendor && data ? (
        <EspaceContext.Provider value={{ user, vendor, data, isEmpty, usage, saveVitrine, upload, updateMedia, replacePhoto, deleteMedia, reorder, saveAlbum, deleteAlbum, saveStory, deleteStory, markAllRead, patch: patchData, typing, setTyping, setUser }}>
          {children}
        </EspaceContext.Provider>
      ) : children}
    </StatusContext.Provider>
  );
}

/** Rend `children` seulement quand les données sont prêtes ; sinon squelette ou erreur */
export function WhenReady({ skeleton, children }: { skeleton: React.ReactNode; children: React.ReactNode }) {
  const { status, retry } = useEspaceStatus();
  const ctx = React.useContext(EspaceContext);
  if (status === "error") return <LoadError onRetry={retry} />;
  if (status !== "ready" || !ctx) return <>{skeleton}</>;
  return <>{children}</>;
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="mx-auto mt-10 max-w-md rounded-3xl border border-danger/40 bg-surface p-8 text-center">
      <p className="font-display text-2xl">Impossible de charger vos données</p>
      <p className="mt-2 text-sm text-muted">Vérifiez votre connexion internet. Rien n’a été perdu.</p>
      <button onClick={onRetry} className="mt-6 inline-flex h-11 items-center rounded-full bg-gold px-6 text-sm font-semibold text-on-gold">Réessayer</button>
    </div>
  );
}
