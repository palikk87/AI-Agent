import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, MoveHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BeforeAfterProps {
  beforeUrl: string;
  afterUrl: string;
  className?: string;
  initialPosition?: number;
}

export function BeforeAfter({ beforeUrl, afterUrl, className, initialPosition }: BeforeAfterProps) {
  const [position, setPosition] = useState(initialPosition ?? 55);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <Slider
        beforeUrl={beforeUrl}
        afterUrl={afterUrl}
        position={position}
        onPositionChange={setPosition}
        className={className}
        onExpand={() => setFullscreen(true)}
      />

      {fullscreen ? (
        <div
          className="fixed inset-0 z-50 bg-black"
          onClick={() => setFullscreen(false)}
        >
          <button
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            onClick={() => setFullscreen(false)}
          >
            <X className="h-5 w-5" />
          </button>
          {/* Use 100dvh/100dvw so the overlay fills correctly on rotation */}
          <div
            className="flex h-[100dvh] w-[100dvw] items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Slider
              beforeUrl={beforeUrl}
              afterUrl={afterUrl}
              position={position}
              onPositionChange={setPosition}
              className="!aspect-auto h-full w-full rounded-none [&_img]:object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

interface SliderProps {
  beforeUrl: string;
  afterUrl: string;
  position: number;
  onPositionChange: (p: number) => void;
  className?: string;
  onExpand?: () => void;
}

function Slider({
  beforeUrl,
  afterUrl,
  position,
  onPositionChange,
  className,
  onExpand,
}: SliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const update = useCallback(
    (clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((clientX - rect.left) / rect.width) * 100;
      onPositionChange(Math.min(100, Math.max(0, x)));
    },
    [onPositionChange]
  );

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (dragging.current) update(e.clientX);
    };
    const touch = (e: TouchEvent) => {
      if (dragging.current && e.touches[0]) update(e.touches[0].clientX);
    };
    const up = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", touch, { passive: true });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", touch);
      window.removeEventListener("touchend", up);
    };
  }, [update]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative aspect-[16/10] w-full select-none overflow-hidden rounded-2xl bg-muted",
        className
      )}
    >
      {/* After (full background) */}
      <img
        src={afterUrl}
        alt="With new garage door"
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      {/* Before (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <img
          src={beforeUrl}
          alt="Original house"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ width: `${(100 / position) * 100}%`, maxWidth: "none" }}
          draggable={false}
        />
      </div>

      {/* Labels */}
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-foreground shadow-sm backdrop-blur">
        Before
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground shadow-sm">
        After
      </span>

      {/* Expand button */}
      {onExpand ? (
        <button
          onClick={onExpand}
          className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {/* Divider */}
      <div
        className="pointer-events-none absolute inset-y-0"
        style={{ left: `${position}%`, transform: "translateX(-1px)" }}
      >
        <div className="h-full w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
      </div>

      {/* Handle */}
      <div
        role="slider"
        aria-valuenow={Math.round(position)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onMouseDown={(e) => {
          dragging.current = true;
          update(e.clientX);
        }}
        onTouchStart={(e) => {
          dragging.current = true;
          if (e.touches[0]) update(e.touches[0].clientX);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onPositionChange(Math.max(0, position - 4));
          if (e.key === "ArrowRight") onPositionChange(Math.min(100, position + 4));
        }}
        className="absolute top-1/2 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-foreground shadow-[0_4px_16px_rgba(0,0,0,0.25),0_0_0_1px_rgba(0,0,0,0.05)] outline-none transition-transform active:scale-95"
        style={{ left: `${position}%` }}
      >
        <MoveHorizontal className="h-4.5 w-4.5" />
      </div>
    </div>
  );
}
