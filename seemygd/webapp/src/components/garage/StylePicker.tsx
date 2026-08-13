import { useMemo, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type {
  CatalogResponse,
  GarageStyle,
  Manufacturer,
} from "@/lib/garage-api";

interface StylePickerProps {
  catalog: CatalogResponse;
  selectedStyleId: string | null;
  onSelect: (style: GarageStyle) => void;
  onGenerate: () => void;
  canGenerate: boolean;
  isGenerating: boolean;
}

const CATEGORY_LABEL: Record<GarageStyle["category"], string> = {
  modern: "Modern",
  carriage: "Carriage",
  traditional: "Traditional",
  contemporary: "Contemporary",
};

export function StylePicker({
  catalog,
  selectedStyleId,
  onSelect,
  onGenerate,
  canGenerate,
  isGenerating,
}: StylePickerProps) {
  const [activeManufacturer, setActiveManufacturer] = useState<
    Manufacturer | "all"
  >("all");

  const filteredStyles = useMemo(() => {
    if (activeManufacturer === "all") return catalog.styles;
    return catalog.styles.filter((s) => s.manufacturer === activeManufacturer);
  }, [activeManufacturer, catalog.styles]);

  const selectedStyle = catalog.styles.find((s) => s.id === selectedStyleId);
  const selectedMfr = selectedStyle
    ? catalog.manufacturers.find((m) => m.id === selectedStyle.manufacturer)
    : null;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-5 pb-4 pt-5 sm:px-6">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-semibold sm:text-2xl">
            Choose a door
          </h2>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {filteredStyles.length} styles
          </span>
        </div>

        <div className="scrollbar-thin -mx-1 mt-4 flex gap-1.5 overflow-x-auto pb-1.5">
          <ManufacturerTab
            label="All"
            active={activeManufacturer === "all"}
            onClick={() => setActiveManufacturer("all")}
          />
          {catalog.manufacturers.map((m) => (
            <ManufacturerTab
              key={m.id}
              label={m.name}
              active={activeManufacturer === m.id}
              onClick={() => setActiveManufacturer(m.id)}
            />
          ))}
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {filteredStyles.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              manufacturerName={
                catalog.manufacturers.find((m) => m.id === style.manufacturer)
                  ?.name ?? ""
              }
              selected={style.id === selectedStyleId}
              onClick={() => onSelect(style)}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-border bg-card/60 px-4 py-4 sm:px-6">
        {selectedStyle ? (
          <div className="mb-3 flex items-center gap-3">
            <div
              className="h-9 w-9 shrink-0 rounded-lg ring-1 ring-border"
              style={{
                background: `linear-gradient(135deg, ${selectedStyle.swatch.panel} 0%, ${selectedStyle.swatch.panel} 60%, ${selectedStyle.swatch.trim} 100%)`,
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">
                {selectedMfr?.name} {selectedStyle.name}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {selectedStyle.series}
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-3 text-xs text-muted-foreground">
            Pick a door style to preview it on your home.
          </div>
        )}
        <Button
          size="lg"
          className="w-full rounded-full"
          disabled={!canGenerate || isGenerating}
          onClick={onGenerate}
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary-foreground" />
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary-foreground [animation-delay:120ms]" />
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary-foreground [animation-delay:240ms]" />
              <span className="ml-2">Generating preview…</span>
            </span>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-4 w-4" />
              Preview on my home
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ManufacturerTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function StyleCard({
  style,
  manufacturerName,
  selected,
  onClick,
}: {
  style: GarageStyle;
  manufacturerName: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-3 text-left transition-all duration-200",
        selected
          ? "border-primary shadow-md shadow-primary/10 ring-2 ring-primary/30"
          : "border-border hover:border-foreground/30 hover:shadow-sm"
      )}
    >
      <div className="relative mb-3 h-20 overflow-hidden rounded-lg ring-1 ring-border/60">
        <DoorPreview style={style} />
        <div className="absolute right-1.5 top-1.5 rounded-full bg-background/85 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground/80 backdrop-blur">
          {CATEGORY_LABEL[style.category]}
        </div>
        {selected ? (
          <div className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
            <Check className="h-3.5 w-3.5" />
          </div>
        ) : null}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">
            {style.name}
          </div>
          <div className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
            {manufacturerName}
          </div>
        </div>
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {style.tagline}
      </p>
    </button>
  );
}

function DoorPreview({ style }: { style: GarageStyle }) {
  const { panel, trim, accent } = style.swatch;
  const isModern =
    style.category === "modern" || style.category === "contemporary";
  const isCarriage = style.category === "carriage";

  return (
    <div
      className="relative h-full w-full"
      style={{
        background: `linear-gradient(180deg, ${panel} 0%, ${panel} 80%, ${trim} 100%)`,
      }}
    >
      {/* Panel divisions */}
      <div className="absolute inset-0 flex flex-col">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-1"
            style={{
              borderTop:
                i === 0
                  ? "none"
                  : `1px solid ${
                      isModern ? trim + "55" : accent + "55"
                    }`,
            }}
          />
        ))}
      </div>

      {/* Windows row */}
      {style.category !== "modern" ? (
        <div className="absolute inset-x-2 top-2 flex h-3 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.85), rgba(220,225,235,0.5))",
                border: `1px solid ${accent}`,
              }}
            />
          ))}
        </div>
      ) : null}

      {/* Carriage hardware */}
      {isCarriage ? (
        <>
          <div
            className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
            style={{ background: accent }}
          />
          <div
            className="absolute right-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
            style={{ background: accent }}
          />
        </>
      ) : null}

      {/* Full-view aluminum frame look for contemporary */}
      {style.id.includes("vista") || style.id.includes("avante") || style.id.includes("8800") ? (
        <div className="absolute inset-1 grid grid-cols-4 grid-rows-3 gap-0.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[1px]"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.6), rgba(200,210,225,0.3))",
                border: `1px solid ${accent}`,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
