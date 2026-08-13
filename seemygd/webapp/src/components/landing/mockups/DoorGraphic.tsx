import { cn } from "@/lib/utils";

/**
 * A stylized garage-door face drawn entirely with divs — mirrors the panel
 * grids the real StyleWizard renders (long-panel + window row + seams). No
 * photos; `panel`/`trim` are hex/CSS colors so it can restyle per swatch.
 */
export function DoorGraphic({
  panel,
  trim,
  windows = true,
  className,
}: {
  panel: string;
  trim: string;
  windows?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("flex h-full w-full flex-col gap-1 overflow-hidden p-1.5", className)}
      style={{ backgroundColor: panel, backgroundImage: `linear-gradient(180deg, ${panel} 0%, ${trim}22 100%)` }}
    >
      {windows ? (
        <div className="flex gap-1" style={{ height: "22%" }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-1 rounded-[2px]"
              style={{
                background: "linear-gradient(135deg, rgba(210,232,255,0.92) 0%, rgba(180,215,250,0.68) 100%)",
                border: `1px solid ${trim}55`,
              }}
            />
          ))}
        </div>
      ) : null}
      {Array.from({ length: 3 }).map((_, row) => (
        <div key={row} className="flex flex-1 gap-1">
          {[0, 1, 2, 3].map((col) => (
            <div
              key={col}
              className="relative flex-1 rounded-[2px]"
              style={{
                backgroundColor: panel,
                boxShadow: "inset 1.5px 1.5px 0 rgba(255,255,255,0.22), inset -1.5px -1.5px 0 rgba(0,0,0,0.14)",
                border: `1px solid ${trim}50`,
              }}
            >
              <div className="absolute inset-[16%] rounded-[1px]" style={{ border: `1px solid ${trim}55` }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
