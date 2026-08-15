import { useEffect, useRef, useState } from "react";
import { Music2, Radio, Square } from "lucide-react";
import { cn } from "@/lib/utils";

const STATIONS = [
  {
    name: "PopTron",
    desc: "Electro-Pop · Indie Dance",
    url: "https://ice1.somafm.com/poptron-128-mp3",
  },
  {
    name: "Groove Salad",
    desc: "Chilled · Ambient",
    url: "https://ice1.somafm.com/groovesalad-128-mp3",
  },
  {
    name: "Beat Blender",
    desc: "Electronic · Deep",
    url: "https://ice1.somafm.com/beatblender-128-mp3",
  },
];

const BAR_HEIGHTS = [0.45, 0.8, 0.55, 1.0, 0.65, 0.35, 0.9, 0.5, 0.75, 0.4, 0.85, 0.6, 0.95, 0.5, 0.7, 0.38];

export function AmbientPlayer() {
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(false);
  const [stationIdx, setStationIdx] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  const startStation = (idx: number) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = 0.45;
    }
    audioRef.current.pause();
    audioRef.current.src = STATIONS[idx].url;
    audioRef.current.play().catch(() => {});
    setStationIdx(idx);
    setPlaying(true);
  };

  const toggle = () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      startStation(stationIdx);
    }
  };

  const station = STATIONS[stationIdx];

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 transition-all duration-500",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}
    >
      {/* Expanded player card when playing */}
      {playing && (
        <div className="mb-3 w-64 rounded-2xl border border-amber-200/70 bg-card/95 p-4 shadow-2xl backdrop-blur-md transition-all">
          {/* Station header */}
          <div className="mb-3 flex items-center gap-3">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <Radio className="h-4 w-4 text-amber-600" />
              <span className="absolute inset-0 animate-ping rounded-full border-2 border-amber-400/40" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{station.name}</div>
              <div className="text-[10px] text-muted-foreground">{station.desc}</div>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              <span className="text-[9px] font-medium text-amber-600">LIVE</span>
            </div>
          </div>

          {/* Waveform bars */}
          <div className="mb-3 flex h-8 items-end gap-[2px]">
            {BAR_HEIGHTS.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-full bg-amber-400/80"
                style={{
                  height: "100%",
                  transformOrigin: "bottom",
                  animation: `wave-bar ${0.7 + (i % 4) * 0.15}s ease-in-out infinite alternate`,
                  animationDelay: `${(i * 0.06) % 0.9}s`,
                  transform: `scaleY(${h})`,
                }}
              />
            ))}
          </div>

          {/* Station picker */}
          <div className="flex gap-1.5">
            {STATIONS.map((s, i) => (
              <button
                key={s.name}
                onClick={() => startStation(i)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-[9px] font-semibold transition-all",
                  i === stationIdx
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-700"
                )}
              >
                {s.name}
              </button>
            ))}
          </div>

          <p className="mt-2 text-[9px] text-muted-foreground/50 text-center">
            SomaFM · listener supported radio
          </p>
        </div>
      )}

      {/* Toggle button */}
      <div className="flex justify-end">
        <button
          onClick={toggle}
          title={playing ? "Stop radio" : "Play radio"}
          className={cn(
            "relative flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-all duration-500",
            playing
              ? "scale-105 border-amber-400/60 bg-amber-500 text-white"
              : "border-border/60 bg-card/90 text-muted-foreground backdrop-blur-sm hover:border-amber-200 hover:bg-amber-50/80 hover:text-amber-600"
          )}
        >
          {playing && (
            <span className="absolute inset-0 animate-ping rounded-full border-2 border-amber-400/50" />
          )}
          {playing ? (
            <Square className="h-4 w-4 fill-current" />
          ) : (
            <Music2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
