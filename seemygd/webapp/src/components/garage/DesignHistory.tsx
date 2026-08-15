import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GarageStyle, SwapResult } from "@/lib/garage-api";

export interface SavedDesign {
  id: string;
  result: SwapResult;
  style: GarageStyle;
  colorName?: string;
  windowOption?: string;
  manufacturerName: string;
}

interface DesignHistoryProps {
  designs: SavedDesign[];
  activeId: string | null;
  onSelect: (design: SavedDesign) => void;
  onClear: () => void;
  onAddNew?: () => void;
}

export function DesignHistory({ designs, activeId, onSelect, onClear, onAddNew }: DesignHistoryProps) {
  if (designs.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Your Designs</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{designs.length}</span>
        </div>
        {designs.length >= 2 ? (
          <button
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {/* Scrollable thumbnail strip */}
      <div className="flex gap-3 overflow-x-auto p-4 [scrollbar-width:none]">
        {designs.map((design) => {
          const isActive = design.id === activeId;
          const colorHex = design.colorName
            ? design.style.colors.find((c) => c.name === design.colorName)?.hex
            : null;
          return (
            <button
              key={design.id}
              onClick={() => onSelect(design)}
              className="w-28 shrink-0 text-left focus:outline-none group"
            >
              <div
                className={cn(
                  "relative overflow-hidden rounded-xl transition-all duration-200",
                  isActive
                    ? "ring-2 ring-primary ring-offset-2"
                    : "ring-1 ring-border hover:ring-primary/40"
                )}
              >
                <img
                  src={`data:image/png;base64,${design.result.imageBase64}`}
                  alt={design.style.name}
                  className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {isActive ? (
                  <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  </div>
                ) : null}
              </div>
              <div className="mt-1.5 px-0.5">
                <div className="flex items-center gap-1">
                  {colorHex ? (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full border border-border/50"
                      style={{ backgroundColor: colorHex }}
                    />
                  ) : null}
                  <span className="truncate text-[11px] font-semibold text-foreground leading-tight">{design.style.name}</span>
                </div>
                {design.colorName ? (
                  <span className="block truncate text-[10px] text-muted-foreground leading-tight mt-0.5">{design.colorName}</span>
                ) : null}
              </div>
            </button>
          );
        })}

        {/* Add new card */}
        {onAddNew ? (
          <button
            onClick={onAddNew}
            className="w-28 shrink-0 focus:outline-none group"
          >
            <div className="aspect-square w-full rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 transition-colors hover:border-primary/40 hover:bg-primary/5">
              <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-[10px] text-muted-foreground group-hover:text-primary text-center leading-tight px-1 transition-colors">Try another style</span>
            </div>
          </button>
        ) : null}
      </div>
    </div>
  );
}
