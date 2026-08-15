import { Info } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  REPAIR_CATALOG,
  REPAIR_PARTS,
  computeRepairPrice,
  type DoorConfig,
  type RepairMultipliers,
  type RepairPartId,
} from "../../../../backend/src/types"

interface RepairPanelProps {
  partId: RepairPartId | null
  onClose: () => void
  brandColor: string
  config: DoorConfig
  multipliers: RepairMultipliers
  /** repairKey -> stored base price (already merged with defaults on the server). */
  basePriceByKey: Record<string, number>
  enabledByKey: Record<string, boolean>
  selected: Set<string>
  onToggle: (repairKey: string) => void
}

export function RepairPanel({
  partId,
  onClose,
  brandColor,
  config,
  multipliers,
  basePriceByKey,
  enabledByKey,
  selected,
  onToggle,
}: RepairPanelProps) {
  const isMobile = useIsMobile()
  const part = partId ? REPAIR_PARTS.find((p) => p.id === partId) ?? null : null
  const options = partId
    ? REPAIR_CATALOG.filter((r) => r.partId === partId && enabledByKey[r.key] !== false)
    : []

  return (
    <Sheet open={partId !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="flex flex-col gap-0 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="text-left">
          <div className="h-1.5 w-16 rounded-full" style={{ backgroundColor: brandColor }} />
          <SheetTitle className="mt-3 text-xl font-bold text-gray-900">{part?.name ?? "Repairs"}</SheetTitle>
          <SheetDescription className="text-sm text-gray-500">{part?.blurb}</SheetDescription>
        </SheetHeader>

        <TooltipProvider delayDuration={150}>
          <div className="mt-5 space-y-3 pb-4">
            {options.length === 0 ? (
              <p className="text-sm text-gray-500">No repairs available for this part right now.</p>
            ) : null}
            {options.map((opt) => {
              const base = basePriceByKey[opt.key] ?? opt.defaultBasePrice
              const price = computeRepairPrice(base, opt.scalesWith, config, multipliers)
              const isSelected = selected.has(opt.key)
              return (
                <label
                  key={opt.key}
                  htmlFor={`repair-${opt.key}`}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-colors"
                  style={
                    isSelected
                      ? { borderColor: brandColor, backgroundColor: `rgba(var(--brand-color-rgb), 0.06)` }
                      : { borderColor: "#e5e7eb" }
                  }
                >
                  <Checkbox
                    id={`repair-${opt.key}`}
                    checked={isSelected}
                    onCheckedChange={() => onToggle(opt.key)}
                    className="mt-0.5 h-6 w-6"
                    style={isSelected ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                        {opt.label}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" onClick={(e) => e.preventDefault()} aria-label="More info">
                              <Info className="h-3.5 w-3.5 text-gray-400" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[240px] text-xs">{opt.description}</TooltipContent>
                        </Tooltip>
                      </span>
                      <span className="shrink-0 text-base font-bold" style={{ color: brandColor }}>
                        ${price}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-snug text-gray-500">{opt.description}</p>
                  </div>
                </label>
              )
            })}
          </div>
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  )
}
