import { type CSSProperties, useRef, useState, useMemo } from "react";
import { Camera, ChevronLeft, ChevronRight, ExternalLink, ImageIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { CatalogResponse, ColorOption, DoorSize, GarageStyle } from "@/lib/garage-api";

type CategoryFilter = "all" | GarageStyle["category"];

const CATEGORY_OPTIONS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All Styles" },
  { id: "modern", label: "Modern" },
  { id: "carriage", label: "Carriage" },
  { id: "traditional", label: "Traditional" },
  { id: "contemporary", label: "Contemporary" },
];

const CATEGORY_COLORS: Record<string, string> = {
  modern: "bg-sky-100 text-sky-700",
  contemporary: "bg-violet-100 text-violet-700",
  carriage: "bg-amber-100 text-amber-800",
  traditional: "bg-emerald-100 text-emerald-700",
};

interface StyleWizardProps {
  imageUrl: string | null;
  catalog: CatalogResponse;
  onGenerate: (style: GarageStyle, colorId?: string, windowOptionId?: string) => void;
  onChangePhoto: () => void;
  onPhotoChange: (file: File | null) => void;
  isGenerating: boolean;
  generationProgress?: number;
  generationElapsed?: number;
  doorSize?: DoorSize;
  companyId?: string;
  brandColor?: string;
}

export function StyleWizard({
  imageUrl,
  catalog,
  onGenerate,
  onChangePhoto,
  onPhotoChange,
  isGenerating,
  generationProgress,
  generationElapsed,
  doorSize,
  // companyId and brandColor are available for parent pages to pass through
  // to downstream components (e.g. ResultViewer, LeadCaptureDialog)
  companyId: _companyId,
  brandColor: _brandColor,
}: StyleWizardProps) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [index, setIndex] = useState(0);
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const [selectedColorId, setSelectedColorId] = useState<string | undefined>(undefined);
  const [selectedWindowId, setSelectedWindowId] = useState<string | undefined>(undefined);

  const GENERATION_MESSAGES = [
    "Analyzing your home's architecture\u2026",
    "Placing the new garage door\u2026",
    "Matching lighting and shadows\u2026",
    "Refining edges and details\u2026",
    "Applying final color corrections\u2026",
    "Almost ready\u2026",
  ];
  const msgIdx = Math.floor(((generationElapsed ?? 0) / 4) % GENERATION_MESSAGES.length);
  const isLongWait = (generationElapsed ?? 0) > 75;

  const filtered = useMemo(() => {
    if (category === "all") return catalog.styles;
    return catalog.styles.filter((s) => s.category === category);
  }, [category, catalog.styles]);

  const safeIdx = Math.min(index, Math.max(0, filtered.length - 1));
  const current = filtered[safeIdx];
  const mfr = catalog.manufacturers.find((m) => m.id === current?.manufacturer);

  const effectiveColorId = selectedColorId ?? current?.colors[0]?.id;
  const effectiveWindowId = selectedWindowId ?? current?.windowOptions[0]?.id;
  const effectiveColor = current?.colors.find((c) => c.id === effectiveColorId) ?? current?.colors[0];

  const handleCategory = (cat: CategoryFilter) => {
    setCategory(cat);
    setIndex(0);
    setSlideDir(null);
    setSelectedColorId(undefined);
    setSelectedWindowId(undefined);
  };

  const navigateTo = (nextIdx: number, dir: "left" | "right") => {
    setSlideDir(dir);
    setIndex(nextIdx);
    setSelectedColorId(undefined);
    setSelectedWindowId(undefined);
  };

  const prev = () => navigateTo((safeIdx - 1 + filtered.length) % filtered.length, "right");
  const next = () => navigateTo((safeIdx + 1) % filtered.length, "left");

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-border shadow-lg">
      {/* Photo preview / upload area */}
      {imageUrl ? (
        <div className="relative">
          <div className="aspect-[4/3] w-full overflow-hidden sm:aspect-[16/10]">
            <img src={imageUrl} alt="Your home" className="h-full w-full object-cover" />
          </div>
          <button
            onClick={onChangePhoto}
            disabled={isGenerating}
            className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/70 disabled:opacity-50"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            Change photo
          </button>
          {isGenerating ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[2px]">
              <div className="rounded-2xl border border-white/10 bg-black/70 px-8 py-6 text-center backdrop-blur-md w-72">
                <div className="mb-4 flex justify-center gap-2">
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-white [animation-delay:-0.3s]" />
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-white [animation-delay:-0.15s]" />
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-white" />
                </div>
                <div className="text-base font-semibold text-white">Crafting your new garage door</div>
                <div className="mt-1.5 min-h-[1.25rem] text-xs text-white/60 transition-all duration-700">
                  {GENERATION_MESSAGES[msgIdx]}
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-300 ease-out"
                    style={{ width: `${generationProgress ?? 0}%` }}
                  />
                </div>
                <div className="mt-1.5 text-sm font-bold text-white">
                  {Math.round(generationProgress ?? 0)}%
                </div>
                {isLongWait ? (
                  <div className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs text-white/70">
                    Taking longer than usual — please wait
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <label className="group relative block cursor-pointer overflow-hidden border-b border-border">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => onPhotoChange(e.target.files?.[0] ?? null)}
          />
          {/* Soft brand gradient wash */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.07] via-background to-secondary/50" />
          {/* Faint house + garage line drawing so the panel never looks empty */}
          <svg
            viewBox="0 0 400 130"
            preserveAspectRatio="xMidYMax slice"
            className="absolute inset-x-0 bottom-0 h-3/4 w-full text-primary/[0.08]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          >
            <path d="M70 130 V62 L200 14 L330 62 V130" />
            <path d="M150 130 V82 H250 V130" />
            <line x1="150" y1="100" x2="250" y2="100" />
            <line x1="200" y1="82" x2="200" y2="130" />
            <rect x="96" y="82" width="32" height="26" rx="2" />
            <rect x="272" y="82" width="32" height="26" rx="2" />
          </svg>

          <div className="relative flex flex-col items-center justify-center gap-3 py-11 px-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/25 transition-transform duration-200 group-hover:-translate-y-1">
              <Camera className="h-7 w-7" />
            </div>
            <div>
              <div className="font-display text-xl font-bold text-foreground sm:text-2xl">Add a photo of your home</div>
              <div className="mt-1 text-sm text-muted-foreground">Snap or upload a front-facing shot to see your new door — or browse styles below first.</div>
            </div>
            <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors group-hover:bg-accent/90">
              <Camera className="h-4 w-4" />
              Upload Photo
            </div>
          </div>
        </label>
      )}

      {!isGenerating ? (
        <div className="bg-card">
          {/* Category tab bar */}
          <div className="flex gap-0 overflow-x-auto border-b border-border [scrollbar-width:none]">
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleCategory(opt.id)}
                className={cn(
                  "shrink-0 border-b-2 px-4 py-3 text-xs font-semibold transition-all whitespace-nowrap",
                  category === opt.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-5">
            {/* Large door preview carousel */}
            <div className="relative overflow-hidden rounded-xl border border-border">
              <div
                key={`${category}-${safeIdx}-${slideDir}`}
                className={cn(
                  "aspect-[2/1] w-full",
                  slideDir === "left" ? "animate-in slide-in-from-right-8 duration-200" : null,
                  slideDir === "right" ? "animate-in slide-in-from-left-8 duration-200" : null
                )}
              >
                {current ? (
                  <DoorPreview style={current} selectedColorHex={effectiveColor?.hex} selectedWindowId={effectiveWindowId} doorSize={doorSize} />
                ) : null}
              </div>

              {/* Nav arrows */}
              <button
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-all hover:bg-black/65 hover:scale-105"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-all hover:bg-black/65 hover:scale-105"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              {/* Counter */}
              <div className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                {safeIdx + 1} / {filtered.length}
              </div>
            </div>

            {/* Dot indicators */}
            {filtered.length <= 12 ? (
              <div className="mt-2.5 flex justify-center gap-1.5">
                {filtered.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => navigateTo(i, i > safeIdx ? "left" : "right")}
                    className={cn(
                      "rounded-full transition-all duration-200",
                      i === safeIdx ? "h-2 w-6 bg-primary" : "h-2 w-2 bg-muted-foreground/25 hover:bg-muted-foreground/50"
                    )}
                  />
                ))}
              </div>
            ) : null}

            {/* Style info */}
            {current ? (
              <>
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", CATEGORY_COLORS[current.category] ?? "bg-secondary text-secondary-foreground")}>
                        {current.category}
                      </span>
                      <span className="text-xs text-muted-foreground">{mfr?.name} · {current.series}</span>
                    </div>
                    <h3 className="mt-1.5 text-xl font-bold leading-tight">{current.name}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{current.tagline}</p>
                  </div>
                </div>

                {/* Color picker */}
                <div className="mt-5">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Color</span>
                    {effectiveColor ? (
                      <span className="text-xs font-medium text-foreground">{effectiveColor.name}</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {current.colors.map((color) => (
                      <ColorSwatch
                        key={color.id}
                        color={color}
                        selected={effectiveColorId === color.id}
                        onClick={() => setSelectedColorId(color.id)}
                      />
                    ))}
                  </div>
                </div>

                {/* Window picker */}
                <div className="mt-5">
                  <div className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Window Style</div>
                  <div className="flex flex-wrap gap-2">
                    {current.windowOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setSelectedWindowId(opt.id)}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                          effectiveWindowId === opt.id
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        )}
                      >
                        {opt.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CTA row */}
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                  <a
                    href={current.catalogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View full catalog
                  </a>
                  {imageUrl ? (
                    <Button
                      onClick={() => onGenerate(current, effectiveColorId, effectiveWindowId)}
                      className="h-10 gap-2 rounded-full px-6 text-sm font-semibold"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Preview on my home
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-10 gap-2 rounded-full px-6 text-sm font-semibold"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Upload photo to preview
                    </Button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ColorSwatch({ color, selected, onClick }: { color: ColorOption; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={color.name}
      className={cn(
        "group relative flex h-9 w-9 items-center justify-center rounded-full transition-all",
        selected ? "ring-2 ring-primary ring-offset-2" : "ring-1 ring-border hover:ring-primary/50 hover:scale-110"
      )}
      style={{ backgroundColor: color.hex }}
    >
      {selected ? (
        <span className="h-2 w-2 rounded-full bg-white/70 shadow-sm" />
      ) : null}
    </button>
  );
}

// ─── Window info ────────────────────────────────────────────────────────────

type WinInfo = {
  noWindows: boolean;
  isArched: boolean;
  isFrosted: boolean;
  isRanch: boolean;
  isBand: boolean;
  isSquare: boolean;
  isTranslucent: boolean;
  isTinted: boolean;
};

function parseWin(style: GarageStyle, selectedWindowId?: string): WinInfo {
  const opt = style.windowOptions.find((w) => w.id === selectedWindowId) ?? style.windowOptions[0];
  const id = opt?.id ?? "";
  const name = (opt?.name ?? "").toLowerCase();
  return {
    noWindows: id === "no-windows" || name.includes("no window"),
    isArched: id.includes("arch") || id.includes("cathedral") || name.includes("arch") || name.includes("cathedral"),
    isFrosted: id.includes("frost") || name.includes("frost"),
    isRanch: id.includes("ranch") || name.includes("ranch"),
    isBand: id.includes("band") || name.includes("band"),
    isSquare: id.includes("square") || name.includes("square"),
    isTranslucent: id.includes("translucent") || name.includes("translucent"),
    isTinted: id.includes("tinted") || name.includes("tinted"),
  };
}

function glassBg(win: WinInfo): string {
  if (win.isFrosted) return "rgba(225,235,255,0.58)";
  if (win.isTinted) return "rgba(175,135,70,0.45)";
  if (win.isTranslucent) return "rgba(255,215,150,0.55)";
  return "linear-gradient(135deg, rgba(210,232,255,0.92) 0%, rgba(180,215,250,0.68) 100%)";
}

function glassPane(win: WinInfo, accent: string, isArched = false, isRanch = false): CSSProperties {
  return {
    background: glassBg(win),
    border: `1px solid ${accent}44`,
    boxShadow: "inset 0 1px 3px rgba(255,255,255,0.35)",
    borderRadius: isArched ? "50% 50% 2px 2px / 80% 80% 2px 2px" : isRanch ? "1px" : "2px",
  };
}

// ─── Door Preview dispatcher ─────────────────────────────────────────────────

function DoorPreview({ style, selectedColorHex, selectedWindowId, doorSize }: {
  style: GarageStyle;
  selectedColorHex?: string;
  selectedWindowId?: string;
  doorSize?: DoorSize;
}) {
  const color = selectedColorHex ?? style.swatch.panel;
  const trim = style.swatch.trim;
  const accent = style.swatch.accent;
  const win = parseWin(style, selectedWindowId);
  const id = style.id;

  // When doorSize is undefined, default to double-car layout as the more visually representative default
  const isSingle = doorSize?.widthClass === "single";
  const isTall = doorSize?.heightClass === "tall";

  if (id === "clopay-avante" || id === "amarr-vista" || id === "wayne-dalton-8800") {
    return <FullViewGlassDoor frameColor={color} accentColor={accent} win={win} isSingle={isSingle} isTall={isTall} />;
  }
  if (id === "amarr-hillcrest") {
    return <FlushBandDoor panelColor={color} trimColor={trim} accentColor={accent} win={win} isTall={isTall} />;
  }
  if (id === "clopay-modern-steel" || id === "haas-700") {
    return <FlushModernDoor panelColor={color} trimColor={trim} accentColor={accent} win={win} isTall={isTall} />;
  }
  if (id === "chi-planks-accents") {
    return <PlanksDoor panelColor={color} trimColor={trim} accentColor={accent} win={win} isTall={isTall} />;
  }
  if (id === "wayne-dalton-9100") {
    return <ShortPanelDoor panelColor={color} trimColor={trim} accentColor={accent} win={win} isSingle={isSingle} isTall={isTall} />;
  }
  if (id === "chi-recessed-panel") {
    return <RecessedPanelDoor panelColor={color} trimColor={trim} accentColor={accent} win={win} isSingle={isSingle} isTall={isTall} />;
  }
  if (style.category === "carriage") {
    return (
      <CarriageDoor
        panelColor={color}
        trimColor={trim}
        accentColor={accent}
        win={win}
        isWood={id === "wayne-dalton-9700" || id === "clopay-canyon-ridge"}
        isStamped={id === "chi-stamped-carriage"}
        isTall={isTall}
      />
    );
  }
  return <LongPanelDoor panelColor={color} trimColor={trim} accentColor={accent} win={win} isContemporary={style.category === "contemporary"} isSingle={isSingle} isTall={isTall} />;
}

// ─── 1. Full-View Glass ───────────────────────────────────────────────────────

function FullViewGlassDoor({ frameColor, accentColor, win, isSingle, isTall }: {
  frameColor: string;
  accentColor: string;
  win: WinInfo;
  isSingle: boolean;
  isTall: boolean;
}) {
  const pane = glassPane(win, accentColor);
  const cols = isSingle ? 4 : 8;
  const rows = isTall ? 4 : 3;
  return (
    <div className="relative h-full w-full flex flex-col gap-[3px] p-3" style={{ backgroundColor: frameColor }}>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex flex-1 gap-[3px]">
          {Array.from({ length: cols }).map((_, col) => (
            <div key={col} className="flex-1" style={pane} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── 2. Flush Modern ─────────────────────────────────────────────────────────

function FlushModernDoor({ panelColor, trimColor, accentColor, win, isTall }: {
  panelColor: string;
  trimColor: string;
  accentColor: string;
  win: WinInfo;
  isTall: boolean;
}) {
  const showWin = !win.noWindows;
  const pane = glassPane(win, accentColor, false, win.isRanch);
  const sections = isTall ? 5 : 4;
  const seams = Array.from({ length: sections - 1 }, (_, i) => Math.round(((i + 1) / sections) * 100));
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ backgroundColor: panelColor }}>
      {seams.map((pct) => (
        <div key={pct} className="absolute inset-x-0" style={{ top: `${pct}%`, height: "2px", backgroundColor: `${trimColor}55` }} />
      ))}
      {showWin ? (
        <div className="absolute inset-x-3 flex gap-2" style={{ top: "4%", height: win.isRanch ? "11%" : "19%" }}>
          {win.isSquare || win.isRanch ? (
            [0, 1, 2, 3].map((i) => <div key={i} className="flex-1" style={pane} />)
          ) : (
            <div className="flex-1" style={pane} />
          )}
        </div>
      ) : null}
    </div>
  );
}

// ─── 3. Flush with Built-in Band (Amarr Hillcrest) ───────────────────────────

function FlushBandDoor({ panelColor, trimColor, accentColor, win, isTall }: {
  panelColor: string;
  trimColor: string;
  accentColor: string;
  win: WinInfo;
  isTall: boolean;
}) {
  const showBand = !win.noWindows;
  const pane = glassPane(win, accentColor, false, win.isRanch);
  const sections = isTall ? 5 : 4;
  const seams = Array.from({ length: sections - 1 }, (_, i) => Math.round(((i + 1) / sections) * 100));
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ backgroundColor: panelColor }}>
      {seams.map((pct) => (
        <div key={pct} className="absolute inset-x-0" style={{ top: `${pct}%`, height: "1.5px", backgroundColor: `${trimColor}44` }} />
      ))}
      {showBand ? (
        <div className="absolute inset-x-4 flex gap-2" style={{ top: "7%", height: win.isRanch ? "11%" : "16%" }}>
          {win.isSquare ? (
            [0, 1, 2, 3].map((i) => <div key={i} className="flex-1" style={pane} />)
          ) : (
            <div className="flex-1" style={pane} />
          )}
        </div>
      ) : null}
    </div>
  );
}

// ─── 4. Horizontal Planks (CHI Planks) ───────────────────────────────────────

function PlanksDoor({ panelColor, trimColor, accentColor, win, isTall }: {
  panelColor: string;
  trimColor: string;
  accentColor: string;
  win: WinInfo;
  isTall: boolean;
}) {
  const showWin = !win.noWindows;
  const pane = glassPane(win, accentColor, win.isArched, win.isRanch);
  const count = isTall ? 5 : 4;
  return (
    <div className="relative h-full w-full flex flex-col overflow-hidden" style={{ backgroundColor: panelColor }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative flex-1"
          style={{ borderBottom: i < count - 1 ? `2px solid ${trimColor}60` : undefined }}
        >
          <div
            className="absolute inset-0"
            style={{ backgroundImage: `linear-gradient(180deg, ${panelColor}f8 0%, ${panelColor} 50%, ${trimColor}1a 100%)` }}
          />
        </div>
      ))}
      {showWin ? (
        <div className="absolute inset-x-3 flex gap-2 z-10" style={{ top: "3%", height: "21%" }}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="flex-1" style={pane} />)}
        </div>
      ) : null}
    </div>
  );
}

// ─── 5. Short Panel / 4-col (Wayne Dalton 9100) ──────────────────────────────

function ShortPanelDoor({ panelColor, trimColor, accentColor, win, isSingle, isTall }: {
  panelColor: string;
  trimColor: string;
  accentColor: string;
  win: WinInfo;
  isSingle: boolean;
  isTall: boolean;
}) {
  const showWin = !win.noWindows;
  const pane = glassPane(win, accentColor, win.isArched, false);
  const cols = isSingle ? 4 : 8;
  const panelRows = showWin ? (isTall ? 4 : 3) : (isTall ? 5 : 4);
  return (
    <div
      className="relative h-full w-full flex flex-col gap-1 p-1.5 overflow-hidden"
      style={{ backgroundColor: panelColor, backgroundImage: `linear-gradient(180deg, ${panelColor} 0%, ${trimColor}14 100%)` }}
    >
      {showWin ? (
        <div className="flex gap-1" style={{ height: "21%" }}>
          {Array.from({ length: cols }).map((_, i) => <div key={i} className="flex-1" style={pane} />)}
        </div>
      ) : null}
      {Array.from({ length: panelRows }).map((_, row) => (
        <div key={row} className="flex flex-1 gap-1">
          {Array.from({ length: cols }).map((_, col) => (
            <div
              key={col}
              className="relative flex-1 rounded-[2px]"
              style={{
                backgroundColor: panelColor,
                boxShadow: `inset 1.5px 1.5px 0 rgba(255,255,255,0.22), inset -1.5px -1.5px 0 rgba(0,0,0,0.14)`,
                border: `1px solid ${trimColor}50`,
              }}
            >
              <div className="absolute inset-[18%] rounded-[1px]" style={{ border: `1px solid ${trimColor}55` }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── 6. Recessed Long Panel (CHI Recessed) ───────────────────────────────────

function RecessedPanelDoor({ panelColor, trimColor, accentColor, win, isSingle, isTall }: {
  panelColor: string;
  trimColor: string;
  accentColor: string;
  win: WinInfo;
  isSingle: boolean;
  isTall: boolean;
}) {
  const showWin = !win.noWindows;
  const pane = glassPane(win, accentColor, false, win.isRanch);
  const cols = isSingle ? 2 : 4;
  const panelRows = showWin ? (isTall ? 4 : 3) : (isTall ? 5 : 4);
  return (
    <div className="relative h-full w-full flex flex-col gap-1.5 p-2 overflow-hidden" style={{ backgroundColor: panelColor }}>
      {showWin ? (
        <div className="flex gap-2" style={{ height: "20%" }}>
          {Array.from({ length: cols }).map((_, i) => <div key={i} className="flex-1 rounded-sm" style={pane} />)}
        </div>
      ) : null}
      {Array.from({ length: panelRows }).map((_, row) => (
        <div key={row} className="flex flex-1 gap-1.5">
          {Array.from({ length: cols }).map((_, col) => (
            <div
              key={col}
              className="relative flex-1 rounded-sm"
              style={{
                backgroundColor: panelColor,
                boxShadow: `inset 3px 3px 5px rgba(0,0,0,0.22), inset -3px -3px 5px rgba(255,255,255,0.05)`,
                border: `1px solid ${trimColor}40`,
              }}
            >
              <div
                className="absolute inset-[10%] rounded-[2px]"
                style={{ backgroundColor: `${trimColor}35`, boxShadow: `inset 2px 2px 3px rgba(0,0,0,0.2)` }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── 7. Traditional Long Panel (Lincoln, Haas 600, etc.) ─────────────────────

function LongPanelDoor({ panelColor, trimColor, accentColor, win, isContemporary, isSingle, isTall }: {
  panelColor: string;
  trimColor: string;
  accentColor: string;
  win: WinInfo;
  isContemporary: boolean;
  isSingle: boolean;
  isTall: boolean;
}) {
  const showWin = !win.noWindows;
  const pane = glassPane(win, accentColor, win.isArched, win.isRanch);
  const cols = isSingle ? 2 : 4;
  const panelRows = showWin ? (isTall ? 4 : 3) : (isTall ? 5 : 4);
  return (
    <div
      className="relative h-full w-full flex flex-col gap-1.5 p-2 overflow-hidden"
      style={{ backgroundColor: panelColor, backgroundImage: `linear-gradient(180deg, ${panelColor} 0%, ${trimColor}1a 100%)` }}
    >
      {showWin ? (
        <div className="flex gap-2" style={{ height: "22%" }}>
          {Array.from({ length: cols }).map((_, i) => <div key={i} className="flex-1" style={pane} />)}
        </div>
      ) : null}
      {Array.from({ length: panelRows }).map((_, row) => (
        <div key={row} className="flex flex-1 gap-1.5">
          {Array.from({ length: cols }).map((_, col) => (
            <div
              key={col}
              className="relative flex-1 rounded-sm"
              style={{
                backgroundColor: panelColor,
                boxShadow: isContemporary
                  ? `inset 1px 1px 0 ${accentColor}30, inset -1px -1px 0 rgba(0,0,0,0.12)`
                  : `inset 2px 2px 0 rgba(255,255,255,0.24), inset -2px -2px 0 rgba(0,0,0,0.14)`,
                border: `1px solid ${trimColor}55`,
              }}
            >
              <div
                className="absolute inset-[12%] rounded-[2px]"
                style={{
                  border: `1px solid ${trimColor}60`,
                  boxShadow: `inset 1px 1px 0 rgba(255,255,255,0.18), inset -1px -1px 0 rgba(0,0,0,0.1)`,
                }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── 8. Carriage Door ────────────────────────────────────────────────────────

function CarriageDoor({ panelColor, trimColor, accentColor, win, isWood, isStamped, isTall }: {
  panelColor: string;
  trimColor: string;
  accentColor: string;
  win: WinInfo;
  isWood: boolean;
  isStamped: boolean;
  isTall: boolean;
}) {
  const showWin = !win.noWindows;
  const pane = glassPane(win, accentColor, win.isArched, win.isRanch);
  const crossTop = showWin ? 27 : 4;
  const panelRows = isTall ? 5 : 4;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        backgroundColor: panelColor,
        backgroundImage: isWood
          ? `repeating-linear-gradient(90deg, transparent 0px, transparent 10px, ${trimColor}20 11px)`
          : undefined,
      }}
    >
      {/* Section seams */}
      {isStamped
        ? Array.from({ length: panelRows - 1 }, (_, i) => Math.round(((i + 1) / panelRows) * 100)).map((pct) => (
            <div key={pct} className="absolute inset-x-0" style={{ top: `${pct}%`, height: "2px", backgroundColor: `${trimColor}80` }} />
          ))
        : (
            <div className="absolute inset-x-0" style={{ top: `${showWin ? 27 : 100}%`, height: "2px", backgroundColor: `${trimColor}70` }} />
          )}

      {/* Center divide */}
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 z-10" style={{ width: "3px", backgroundColor: `${trimColor}cc` }} />

      {/* Cross-buck SVG */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ pointerEvents: "none" }}>
        {isStamped ? (
          Array.from({ length: panelRows }).map((_, row) => {
            const t = Math.round((row / panelRows) * 100) + 2;
            const b = Math.round(((row + 1) / panelRows) * 100) - 2;
            return (
              <g key={row}>
                <line x1="2" y1={t} x2="48" y2={b} stroke={`${accentColor}50`} strokeWidth="1.2" />
                <line x1="48" y1={t} x2="2" y2={b} stroke={`${accentColor}50`} strokeWidth="1.2" />
                <line x1="52" y1={t} x2="98" y2={b} stroke={`${accentColor}50`} strokeWidth="1.2" />
                <line x1="98" y1={t} x2="52" y2={b} stroke={`${accentColor}50`} strokeWidth="1.2" />
              </g>
            );
          })
        ) : (
          <>
            <line x1="3" y1={crossTop} x2="47" y2="96" stroke={`${accentColor}55`} strokeWidth="1.3" />
            <line x1="47" y1={crossTop} x2="3" y2="96" stroke={`${accentColor}55`} strokeWidth="1.3" />
            <line x1="53" y1={crossTop} x2="97" y2="96" stroke={`${accentColor}55`} strokeWidth="1.3" />
            <line x1="97" y1={crossTop} x2="53" y2="96" stroke={`${accentColor}55`} strokeWidth="1.3" />
          </>
        )}
      </svg>

      {/* Window row */}
      {showWin ? (
        <div className="absolute inset-x-4 flex gap-3 z-10" style={{ top: "4%", height: "20%" }}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="flex-1" style={pane} />)}
        </div>
      ) : null}

      {/* Hinges left */}
      {[20, 50, 80].map((pct) => (
        <div key={`hl${pct}`} className="absolute z-10 rounded-sm" style={{ left: "2%", top: `${pct}%`, width: "4%", height: "4.5%", backgroundColor: accentColor, transform: "translateY(-50%)" }} />
      ))}
      {/* Hinges right */}
      {[20, 50, 80].map((pct) => (
        <div key={`hr${pct}`} className="absolute z-10 rounded-sm" style={{ right: "2%", top: `${pct}%`, width: "4%", height: "4.5%", backgroundColor: accentColor, transform: "translateY(-50%)" }} />
      ))}

      {/* Center handles */}
      <div className="absolute z-10 rounded-sm" style={{ left: "43%", top: "46%", width: "6%", height: "7%", backgroundColor: accentColor }} />
      <div className="absolute z-10 rounded-sm" style={{ left: "51%", top: "46%", width: "6%", height: "7%", backgroundColor: accentColor }} />

      {/* Floor track */}
      <div className="absolute bottom-0 inset-x-0 h-1.5" style={{ backgroundColor: trimColor }} />
    </div>
  );
}
