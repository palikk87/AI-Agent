import { useState } from "react"
import { Check } from "lucide-react"
import { REPAIR_PARTS, type DoorConfig, type RepairPartId } from "../../../../backend/src/types"

interface GarageDoorDiagramProps {
  config: DoorConfig
  brandColor: string
  /** repairKeys currently in the cart — used to badge parts that have a selection. */
  selectedByPart: Record<RepairPartId, number>
  onSelectPart: (partId: RepairPartId) => void
}

interface Hotspot {
  id: RepairPartId
  /** number pin position */
  pin: { x: number; y: number }
  label: string
}

// Pin coordinates on the 400x320 viewBox. Positions match the drawn geometry.
const HOTSPOTS: Hotspot[] = [
  { id: "opener", pin: { x: 200, y: 34 }, label: "Opener" },
  { id: "springs", pin: { x: 200, y: 96 }, label: "Springs" },
  { id: "sections", pin: { x: 200, y: 210 }, label: "Panels" },
  { id: "hinges", pin: { x: 130, y: 175 }, label: "Hinges" },
  { id: "rollers", pin: { x: 300, y: 150 }, label: "Rollers" },
  { id: "cables", pin: { x: 68, y: 180 }, label: "Cables" },
]

export function GarageDoorDiagram({
  config,
  brandColor,
  selectedByPart,
  onSelectPart,
}: GarageDoorDiagramProps) {
  const [hovered, setHovered] = useState<RepairPartId | null>(null)
  const partName = (id: RepairPartId) => REPAIR_PARTS.find((p) => p.id === id)?.name ?? id

  const zoneProps = (id: RepairPartId) => ({
    className: "cursor-pointer",
    onMouseEnter: () => setHovered(id),
    onMouseLeave: () => setHovered(null),
    onClick: () => onSelectPart(id),
    role: "button" as const,
    "aria-label": `Repair ${partName(id)}`,
  })

  const zoneFill = (id: RepairPartId) =>
    hovered === id ? `rgba(var(--brand-color-rgb), 0.14)` : "transparent"
  const zoneStroke = (id: RepairPartId) => (hovered === id ? brandColor : "transparent")

  return (
    <div className="rounded-3xl border border-white/10 bg-white p-4 shadow-xl sm:p-6">
      <div className="mb-3 text-center">
        <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Tap the part that needs fixing</h2>
        <p className="mt-1 text-sm text-gray-500">Here's the inside of your garage door. The numbered spots are clickable.</p>
      </div>

      <svg
        viewBox="0 0 400 320"
        className="h-auto w-full select-none"
        style={{ touchAction: "manipulation" }}
      >
        {/* ceiling + opener rail */}
        <rect x="0" y="0" width="400" height="18" fill="#e5e7eb" />
        <line x1="200" y1="46" x2="200" y2="120" stroke="#9ca3af" strokeWidth="3" />

        {/* tracks (vertical rails) */}
        <line x1="56" y1="60" x2="56" y2="300" stroke="#cbd5e1" strokeWidth="5" />
        <line x1="344" y1="60" x2="344" y2="300" stroke="#cbd5e1" strokeWidth="5" />

        {/* springs (per config) */}
        {config.springs === "torsion" ? (
          <g>
            <line x1="120" y1="80" x2="280" y2="80" stroke="#9ca3af" strokeWidth="3" />
            <rect x="150" y="72" width="100" height="16" rx="8" fill="none" stroke={brandColor} strokeWidth="3" />
            {[156, 166, 176, 186, 196, 206, 216, 226, 236].map((x) => (
              <line key={x} x1={x} y1="72" x2={x + 6} y2="88" stroke={brandColor} strokeWidth="2" />
            ))}
          </g>
        ) : (
          <g>
            {[70, 330].map((x) => (
              <g key={x}>
                {[92, 100, 108, 116, 124, 132, 140].map((y) => (
                  <line key={y} x1={x - 7} y1={y} x2={x + 7} y2={y + 5} stroke={brandColor} strokeWidth="2" />
                ))}
              </g>
            ))}
          </g>
        )}

        {/* door panels (sections) */}
        {[120, 165, 210, 255].map((y, i) => (
          <g key={y}>
            <rect x="64" y={y} width="272" height="43" rx="2" fill="#f3f4f6" stroke="#94a3b8" strokeWidth="1.5" />
            {i < 3 ? (
              <>
                {/* hinges between panels */}
                <rect x="96" y={y + 40} width="18" height="8" rx="2" fill="#94a3b8" />
                <rect x="286" y={y + 40} width="18" height="8" rx="2" fill="#94a3b8" />
              </>
            ) : null}
          </g>
        ))}

        {/* cables down the sides */}
        <line x1="66" y1="86" x2="66" y2="296" stroke="#64748b" strokeWidth="2" />
        <line x1="334" y1="86" x2="334" y2="296" stroke="#64748b" strokeWidth="2" />

        {/* rollers in tracks */}
        {[130, 200, 270].map((y) => (
          <g key={y}>
            <circle cx="56" cy={y} r="6" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
            <circle cx="344" cy={y} r="6" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
          </g>
        ))}

        {/* opener motor */}
        <rect x="176" y="20" width="48" height="26" rx="4" fill="#cbd5e1" stroke="#64748b" strokeWidth="2" />

        {/* ---- clickable hotspot zones ---- */}
        <g {...zoneProps("opener")}>
          <rect x="160" y="16" width="80" height="34" rx="6" fill={zoneFill("opener")} stroke={zoneStroke("opener")} strokeWidth="2" />
        </g>
        <g {...zoneProps("springs")}>
          <rect x="60" y="68" width="280" height="34" rx="6" fill={zoneFill("springs")} stroke={zoneStroke("springs")} strokeWidth="2" />
        </g>
        <g {...zoneProps("cables")}>
          <rect x="44" y="86" width="34" height="210" rx="6" fill={zoneFill("cables")} stroke={zoneStroke("cables")} strokeWidth="2" />
        </g>
        <g {...zoneProps("rollers")}>
          <rect x="322" y="86" width="34" height="210" rx="6" fill={zoneFill("rollers")} stroke={zoneStroke("rollers")} strokeWidth="2" />
        </g>
        <g {...zoneProps("hinges")}>
          <rect x="90" y="118" width="34" height="178" rx="6" fill={zoneFill("hinges")} stroke={zoneStroke("hinges")} strokeWidth="2" />
        </g>
        <g {...zoneProps("sections")}>
          <rect x="130" y="118" width="180" height="178" rx="6" fill={zoneFill("sections")} stroke={zoneStroke("sections")} strokeWidth="2" />
        </g>

        {/* ---- number pins (always visible) ---- */}
        {HOTSPOTS.map((h, i) => {
          const count = selectedByPart[h.id] ?? 0
          return (
            <g key={h.id} {...zoneProps(h.id)}>
              <circle
                cx={h.pin.x}
                cy={h.pin.y}
                r="13"
                fill={count > 0 ? brandColor : "#ffffff"}
                stroke={brandColor}
                strokeWidth="2.5"
              />
              {count > 0 ? (
                <path
                  d={`M ${h.pin.x - 5} ${h.pin.y} l 3.5 3.5 l 6 -7`}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <text
                  x={h.pin.x}
                  y={h.pin.y + 4}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="700"
                  fill={brandColor}
                >
                  {i + 1}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* legend */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {HOTSPOTS.map((h, i) => {
          const count = selectedByPart[h.id] ?? 0
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => onSelectPart(h.id)}
              onMouseEnter={() => setHovered(h.id)}
              onMouseLeave={() => setHovered(null)}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-left transition-colors hover:bg-gray-50"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={
                  count > 0
                    ? { backgroundColor: brandColor, color: "#fff" }
                    : { border: `2px solid ${brandColor}`, color: brandColor }
                }
              >
                {count > 0 ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="text-sm font-medium text-gray-800">{partName(h.id)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
