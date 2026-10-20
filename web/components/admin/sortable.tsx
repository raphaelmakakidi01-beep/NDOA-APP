"use client";

import * as React from "react";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type HandleProps = React.HTMLAttributes<HTMLButtonElement> & { ref: (el: HTMLElement | null) => void };

/**
 * Liste réordonnable au glisser-déposer : souris, toucher (appui long) et clavier
 * (Espace pour saisir, flèches pour déplacer). L'ordre n'est enregistré qu'au dépôt.
 */
export function SortableList<T>({ items, getId, onReorder, layout = "list", label, className, children }: {
  items: T[]; getId: (item: T) => string; onReorder: (next: T[]) => void; layout?: "list" | "grid"; label: (item: T) => string;
  className?: string; children: (item: T, handle: HandleProps, dragging: boolean) => React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);
  const name = (id: string | number) => { const it = items.find((x) => getId(x) === String(id)); return it ? label(it) : "Élément"; };

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    onReorder(arrayMove(items, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: "Appuyez sur Espace pour saisir l’élément, puis utilisez les flèches pour le déplacer. Espace pour déposer, Échap pour annuler." },
        announcements: {
          onDragStart: ({ active }) => `${name(active.id)} saisi.`,
          onDragOver: ({ over }) => (over ? `Position ${ids.indexOf(String(over.id)) + 1} sur ${ids.length}.` : ""),
          onDragEnd: ({ active, over }) => (over ? `${name(active.id)} déposé en position ${ids.indexOf(String(over.id)) + 1}.` : "Déplacement annulé."),
          onDragCancel: () => "Déplacement annulé.",
        },
      }}>
      <SortableContext items={ids} strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((it) => <Item key={getId(it)} id={getId(it)} label={label(it)} render={(h, d) => children(it, h, d)} />)}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function Item({ id, label, render }: { id: string; label: string; render: (h: HandleProps, dragging: boolean) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("relative min-w-0", isDragging && "z-10")}>
      {render({ ...attributes, ...listeners, ref: setActivatorNodeRef, "aria-label": `Déplacer ${label}` } as HandleProps, isDragging)}
    </li>
  );
}

/** Poignée de déplacement standard */
export function DragHandle({ handle, className }: { handle: HandleProps; className?: string }) {
  const { ref, ...rest } = handle;
  return (
    <button type="button" ref={ref} {...rest}
      className={cn("grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text active:cursor-grabbing", className)}>
      <GripVertical className="size-4" aria-hidden />
    </button>
  );
}
