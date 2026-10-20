"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";

const RATIOS = { "4:5": 4 / 5, "1:1": 1, "3:2": 3 / 2, "16:9": 16 / 9 } as const;
type Ratio = keyof typeof RATIOS;

/** Découpe la zone choisie dans un canvas et renvoie un WebP */
async function cropToBlob(src: string, area: Area) {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Image illisible"));
    i.src = src;
  });
  const scale = Math.min(1, 2560 / Math.max(area.width, area.height));
  const c = document.createElement("canvas");
  c.width = Math.round(area.width * scale);
  c.height = Math.round(area.height * scale);
  c.getContext("2d")!.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", 0.86));
  if (!blob) throw new Error("Recadrage impossible");
  return { blob, width: c.width, height: c.height };
}

export function CropDialog({ open, onOpenChange, src, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; src: string;
  onDone: (r: { blob: Blob; width: number; height: number }) => Promise<void> | void;
}) {
  const [ratio, setRatio] = useState<Ratio>("4:5");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const onComplete = useCallback((_: Area, px: Area) => setArea(px), []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Recadrer la photo" description="Glissez l’image pour la cadrer, utilisez le curseur pour zoomer." wide
      footer={<>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
        <Button loading={busy} disabled={!area} onClick={async () => {
          if (!area) return;
          setBusy(true);
          try { await onDone(await cropToBlob(src, area)); onOpenChange(false); toast.success("Photo recadrée"); }
          catch { toast.error("Le recadrage a échoué. Réessayez."); }
          setBusy(false);
        }}>Appliquer</Button>
      </>}>
      <div className="grid gap-4">
        <Segmented label="Format" layoutId="crop-ratio" value={ratio} onChange={setRatio} className="w-full sm:w-auto"
          options={(Object.keys(RATIOS) as Ratio[]).map((r) => ({ value: r, label: r }))} />
        <div className="relative h-[46dvh] min-h-64 overflow-hidden rounded-2xl bg-black">
          <Cropper image={src} crop={crop} zoom={zoom} aspect={RATIOS[ratio]} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onComplete}
            objectFit="contain" showGrid style={{ cropAreaStyle: { border: "2px solid #C4975A" } }} />
        </div>
        <label className="grid gap-2 text-sm font-semibold">
          Zoom
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="accent-[#C4975A]" />
        </label>
      </div>
    </Dialog>
  );
}
