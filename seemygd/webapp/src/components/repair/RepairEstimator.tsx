import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Pencil, Wrench } from "lucide-react"
import { api } from "@/lib/api"
import { DoorInfoWizard } from "./DoorInfoWizard"
import { GarageDoorDiagram } from "./GarageDoorDiagram"
import { RepairPanel } from "./RepairPanel"
import { EstimateCart, type CartLine } from "./EstimateCart"
import { RepairRequestDialog } from "./RepairRequestDialog"
import {
  REPAIR_CATALOG,
  computeRepairPrice,
  effectiveRepairPrices,
  DEFAULT_REPAIR_MULTIPLIERS,
  type DoorConfig,
  type RepairPartId,
  type RepairPricingResponse,
} from "../../../../backend/src/types"

interface RepairEstimatorCompany {
  id: string
  businessName: string
  contactPhone: string | null
}

interface RepairEstimatorProps {
  companyId?: string
  brandColor: string
  company: RepairEstimatorCompany | null
}

const WIDTH_LABEL: Record<DoorConfig["width"], string> = { "1car": "1-Car", "2car": "2-Car" }
const HEIGHT_LABEL: Record<DoorConfig["height"], string> = { standard: "Standard height", tall: "Extra Tall" }
const INSULATION_LABEL: Record<DoorConfig["insulation"], string> = {
  hollow: "Hollow",
  vinyl: "Vinyl Back",
  steel: "Steel Back",
}
const SPRING_LABEL: Record<DoorConfig["springs"], string> = {
  torsion: "Torsion springs",
  extension: "Extension springs",
}

export function RepairEstimator({ companyId, brandColor, company }: RepairEstimatorProps) {
  const [config, setConfig] = useState<DoorConfig | null>(null)
  const [editing, setEditing] = useState<boolean>(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [openPart, setOpenPart] = useState<RepairPartId | null>(null)
  const [requestOpen, setRequestOpen] = useState<boolean>(false)

  const pricingQuery = useQuery({
    queryKey: ["repair-pricing", companyId],
    queryFn: () => api.get<RepairPricingResponse>(`/api/repair/${companyId}/pricing`),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  })

  // When there's no company (e.g. the public homepage demo), fall back to the
  // shared catalog defaults so the estimator still works with sensible pricing.
  const fallbackPricing = useMemo<RepairPricingResponse>(
    () => ({ enabled: true, multipliers: DEFAULT_REPAIR_MULTIPLIERS, prices: effectiveRepairPrices([]) }),
    []
  )
  const pricing = pricingQuery.data ?? (companyId ? null : fallbackPricing)

  const basePriceByKey = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const p of pricing?.prices ?? []) map[p.repairKey] = p.basePrice
    return map
  }, [pricing])

  const enabledByKey = useMemo<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    for (const p of pricing?.prices ?? []) map[p.repairKey] = p.enabled
    return map
  }, [pricing])

  const catalogByKey = useMemo(() => {
    const map = new Map(REPAIR_CATALOG.map((r) => [r.key, r]))
    return map
  }, [])

  const priceFor = (repairKey: string): number => {
    const entry = catalogByKey.get(repairKey)
    if (!entry || !config || !pricing) return 0
    const base = basePriceByKey[repairKey] ?? entry.defaultBasePrice
    return computeRepairPrice(base, entry.scalesWith, config, pricing.multipliers)
  }

  const cartLines = useMemo<CartLine[]>(() => {
    const lines: CartLine[] = []
    for (const key of selected) {
      const entry = catalogByKey.get(key)
      if (!entry) continue
      lines.push({ repairKey: key, label: entry.label, price: priceFor(key) })
    }
    return lines
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, config, pricing, basePriceByKey])

  const serviceCallFee = pricing?.multipliers.serviceCallFee ?? 0
  const total = cartLines.reduce((sum, l) => sum + l.price, 0) + (cartLines.length > 0 ? serviceCallFee : 0)

  const selectedByPart = useMemo<Record<RepairPartId, number>>(() => {
    const counts = { springs: 0, cables: 0, rollers: 0, hinges: 0, sections: 0, opener: 0 }
    for (const key of selected) {
      const entry = catalogByKey.get(key)
      if (entry) counts[entry.partId] += 1
    }
    return counts
  }, [selected, catalogByKey])

  const toggle = (repairKey: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(repairKey)) next.delete(repairKey)
      else next.add(repairKey)
      return next
    })
  }

  const repairSummary = useMemo(() => {
    if (!config) return ""
    const doorLine = `Door: ${WIDTH_LABEL[config.width]}, ${HEIGHT_LABEL[config.height]}, ${INSULATION_LABEL[config.insulation]}, ${SPRING_LABEL[config.springs]}`
    const repairLines = cartLines.map((l) => `• ${l.label} — $${l.price.toLocaleString()}`)
    if (serviceCallFee > 0 && cartLines.length > 0) {
      repairLines.push(`• Service call fee — $${serviceCallFee.toLocaleString()}`)
    }
    return [doorLine, "", ...repairLines, "", `Estimated Total: $${total.toLocaleString()}`].join("\n")
  }, [config, cartLines, serviceCallFee, total])

  // --- Loading / disabled states ---
  if (pricingQuery.isLoading) {
    return <div className="h-72 w-full animate-pulse rounded-3xl bg-gray-800/60" />
  }
  if (pricingQuery.isError || (pricing && !pricing.enabled)) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white p-8 text-center shadow-xl">
        <Wrench className="mx-auto mb-3 h-8 w-8 text-gray-400" />
        <h2 className="text-lg font-bold text-gray-900">Repair Estimator unavailable</h2>
        <p className="mt-1 text-sm text-gray-500">
          This tool isn't turned on right now.
          {company?.contactPhone ? ` Please call ${company.contactPhone} for a quote.` : ""}
        </p>
      </div>
    )
  }

  // --- Step 1: wizard ---
  if (!config || editing) {
    return (
      <DoorInfoWizard
        brandColor={brandColor}
        initial={config ?? undefined}
        onComplete={(c) => {
          setConfig(c)
          setEditing(false)
        }}
      />
    )
  }

  // --- Step 2: diagram + cart ---
  return (
    <div>
      {/* Door summary + edit */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/40 px-4 py-3 backdrop-blur-sm">
        <div className="text-sm text-white/85">
          <span className="font-semibold text-white">Your door: </span>
          {WIDTH_LABEL[config.width]}, {HEIGHT_LABEL[config.height]}, {INSULATION_LABEL[config.insulation]},{" "}
          {SPRING_LABEL[config.springs]}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex min-h-[36px] items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/25"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit door details
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <GarageDoorDiagram
          config={config}
          brandColor={brandColor}
          selectedByPart={selectedByPart}
          onSelectPart={(id) => setOpenPart(id)}
        />
        <EstimateCart
          brandColor={brandColor}
          lines={cartLines}
          serviceCallFee={serviceCallFee}
          total={total}
          onRemove={toggle}
          onRequest={() => setRequestOpen(true)}
        />
      </div>

      {pricing ? (
        <RepairPanel
          partId={openPart}
          onClose={() => setOpenPart(null)}
          brandColor={brandColor}
          config={config}
          multipliers={pricing.multipliers}
          basePriceByKey={basePriceByKey}
          enabledByKey={enabledByKey}
          selected={selected}
          onToggle={toggle}
        />
      ) : null}

      <RepairRequestDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        brandColor={brandColor}
        companyId={companyId}
        companyName={company?.businessName}
        companyPhone={company?.contactPhone}
        estimateTotal={total}
        repairSummary={repairSummary}
      />
    </div>
  )
}
