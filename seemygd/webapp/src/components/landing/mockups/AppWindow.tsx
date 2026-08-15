import { cn } from "@/lib/utils";

interface AppWindowProps {
  /** Fake URL shown in the browser top bar. */
  url?: string;
  className?: string;
  /** Optional extra classes for the inner content area. */
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * A subtle "app window" chrome — three traffic-light dots plus a faint URL
 * pill — so the CSS-drawn mockups inside read as real product screenshots.
 * Zero external images: everything here is divs.
 */
export function AppWindow({ url, className, bodyClassName, children }: AppWindowProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl ring-1 ring-black/5",
        className
      )}
    >
      {/* Browser top bar */}
      <div className="flex items-center gap-2 border-b border-black/5 bg-[hsl(38_22%_97%)] px-3 py-2.5">
        <div className="flex shrink-0 gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        {url ? (
          <div className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-black/5 px-2.5 py-1">
            <span className="h-2 w-2 shrink-0 rounded-full border border-slate-400/60" />
            <span className="truncate text-[10px] font-medium text-slate-500 sm:text-[11px]">
              {url}
            </span>
          </div>
        ) : null}
      </div>

      <div className={cn("bg-[hsl(38_22%_97%)]", bodyClassName)}>{children}</div>
    </div>
  );
}
