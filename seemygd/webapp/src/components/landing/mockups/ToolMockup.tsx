import { Sparkles, Wrench, ChevronLeft, ChevronRight } from "lucide-react";
import { AppWindow } from "./AppWindow";
import { DoorGraphic } from "./DoorGraphic";

/** Color swatches mirroring the StyleWizard color picker. */
const SWATCHES: { hex: string; selected?: boolean }[] = [
  { hex: "#3a3f45", selected: true },
  { hex: "#f4f1ea" },
  { hex: "#7a4a2b" },
  { hex: "#1f4f6b" },
  { hex: "#8a1f1f" },
];

/**
 * Faithful, image-free recreation of the live tool (src/pages/Index.tsx):
 * the two-card "Design a New Door / Estimate a Repair" switcher plus a
 * before→after preview panel with a CSS-drawn door and a color picker row.
 */
export function ToolMockup() {
  return (
    <AppWindow url="seemygd.com/tool">
      <div className="p-3 sm:p-4">
        {/* Tool switcher — two cards, "Design" selected */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-xl border-2 border-accent bg-white px-3 py-2.5 shadow-sm">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="text-xs font-bold text-accent">Design a New Door</div>
              <div className="text-[10px] text-slate-500">See it on your home</div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white/70 px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
              <Wrench className="h-4 w-4" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="text-xs font-bold text-slate-700">Estimate a Repair</div>
              <div className="text-[10px] text-slate-500">Get a fix price</div>
            </div>
          </div>
        </div>

        {/* Before → After preview */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="relative overflow-hidden rounded-xl border border-slate-200">
            <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-semibold text-white">
              Before
            </span>
            <HouseScene doorPanel="#c9c3b6" doorTrim="#a39c8c" windows={false} />
          </div>
          <div className="relative overflow-hidden rounded-xl border-2 border-accent shadow-sm">
            <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-accent px-2 py-0.5 text-[9px] font-semibold text-white">
              After
            </span>
            <HouseScene doorPanel="#3a3f45" doorTrim="#20242a" windows />
          </div>
        </div>

        {/* Carousel dots + color picker */}
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-sky-700">
                <span className="rounded-full bg-sky-100 px-2 py-0.5">Modern</span>
              </div>
              <div className="mt-1 truncate text-sm font-bold text-slate-800">Clopay Modern Steel</div>
            </div>
            <div className="flex shrink-0 gap-1">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <ChevronLeft className="h-3.5 w-3.5" />
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="mr-1 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
                Color
              </span>
              {SWATCHES.map((s, i) => (
                <span
                  key={i}
                  className={
                    s.selected
                      ? "h-5 w-5 rounded-full ring-2 ring-slate-800 ring-offset-1"
                      : "h-5 w-5 rounded-full ring-1 ring-slate-300"
                  }
                  style={{ backgroundColor: s.hex }}
                />
              ))}
            </div>
            <span className="hidden shrink-0 rounded-full bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground sm:inline-flex sm:items-center sm:gap-1">
              <Sparkles className="h-3 w-3" /> Preview
            </span>
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

/** A minimal CSS house with a garage door, drawn with divs + the DoorGraphic. */
function HouseScene({
  doorPanel,
  doorTrim,
  windows,
}: {
  doorPanel: string;
  doorTrim: string;
  windows: boolean;
}) {
  return (
    <div className="relative aspect-[4/3] w-full bg-gradient-to-b from-sky-200 to-sky-50">
      {/* Roof */}
      <div
        className="absolute inset-x-0 top-0 h-[38%]"
        style={{
          background: "#6b7280",
          clipPath: "polygon(50% 0, 100% 100%, 0 100%)",
        }}
      />
      {/* Wall */}
      <div className="absolute inset-x-[8%] bottom-0 top-[34%] rounded-t-sm bg-[#e9e2d3]" />
      {/* Door */}
      <div className="absolute bottom-[6%] left-1/2 h-[46%] w-[58%] -translate-x-1/2 overflow-hidden rounded-t-sm shadow-md">
        <DoorGraphic panel={doorPanel} trim={doorTrim} windows={windows} />
      </div>
      {/* Ground */}
      <div className="absolute inset-x-0 bottom-0 h-[6%] bg-[#b8ab8f]" />
    </div>
  );
}
