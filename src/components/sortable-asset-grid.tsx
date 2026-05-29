import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, GripVertical } from "lucide-react";

export type GridItem = {
  linkId: string;
  url: string;
  fileName: string;
  fileType: string | null;
  role: string;
  uploadedAt: string;
  isMain: boolean;
};

export function SortableAssetGrid({
  items, onReorder, onOpen,
}: {
  items: GridItem[];
  onReorder: (newOrder: GridItem[]) => void;
  onOpen: (index: number) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex((i) => i.linkId === active.id);
    const newIdx = items.findIndex((i) => i.linkId === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onReorder(arrayMove(items, oldIdx, newIdx));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.linkId)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {items.map((it, idx) => (
            <SortableTile key={it.linkId} item={it} onOpen={() => onOpen(idx)} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableTile({ item, onOpen }: { item: GridItem; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.linkId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const isImg = item.fileType?.startsWith("image/");

  return (
    <Card ref={setNodeRef} style={style} className="surface-elevated border-0 overflow-hidden group relative">
      <button
        type="button"
        onClick={onOpen}
        className="block aspect-square w-full bg-muted relative cursor-zoom-in"
      >
        {isImg ? (
          <img src={item.url} alt={item.fileName} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="size-full grid place-items-center text-xs text-muted-foreground p-3 text-center">{item.fileName}</div>
        )}
        {item.isMain && (
          <Badge className="absolute top-2 right-2 bg-accent text-accent-foreground gap-1 shadow-md">
            <Star className="size-3 fill-current" /> رئيسية
          </Badge>
        )}
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 left-2 size-7 rounded-md bg-black/50 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition cursor-grab active:cursor-grabbing"
          title="اسحب لإعادة الترتيب"
        >
          <GripVertical className="size-4" />
        </button>
      </button>
      <div className="p-2 space-y-1">
        <div className="text-[11px] truncate font-medium" title={item.fileName}>{item.fileName}</div>
        <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
          <span className="px-1.5 py-0.5 rounded bg-secondary capitalize">{item.role.replace("_", " ")}</span>
          <span className="num" dir="ltr">{new Date(item.uploadedAt).toLocaleDateString("en-GB")}</span>
        </div>
      </div>
    </Card>
  );
}
