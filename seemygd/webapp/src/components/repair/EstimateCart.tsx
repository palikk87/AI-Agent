import { X, ShoppingCart, MousePointerClick } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface CartLine {
  repairKey: string
  label: string
  price: number
}

interface EstimateCartProps {
  brandColor: string
  lines: CartLine[]
  serviceCallFee: number
  total: number
  onRemove: (repairKey: string) => void
  onRequest: () => void
}

export function EstimateCart({
  brandColor,
  lines,
  serviceCallFee,
  total,
  onRemove,
  onRequest,
}: EstimateCartProps) {
  const isEmpty = lines.length === 0

  return (
    <div className="rounded-3xl border border-white/10 bg-white p-5 shadow-xl sm:sticky sm:top-6">
      <div className="mb-3 flex items-center gap-2">
        <ShoppingCart className="h-5 w-5" style={{ color: brandColor }} />
        <h2 className="text-lg font-bold text-gray-900">Your Estimate</h2>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center rounded-2xl bg-gray-50 px-4 py-8 text-center">
          <MousePointerClick className="mb-2 h-7 w-7 text-gray-400" />
          <p className="text-sm text-gray-500">Tap a part on the diagram to start your estimate.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lines.map((line) => (
            <div key={line.repairKey} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-900">{line.label}</div>
              </div>
              <span className="text-sm font-semibold text-gray-900">${line.price.toLocaleString()}</span>
              <button
                type="button"
                onClick={() => onRemove(line.repairKey)}
                aria-label={`Remove ${line.label}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          {serviceCallFee > 0 ? (
            <div className="flex items-center justify-between px-3 py-1.5 text-sm text-gray-500">
              <span>Service call fee</span>
              <span className="font-medium text-gray-700">${serviceCallFee.toLocaleString()}</span>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
        <span className="text-base font-bold text-gray-900">Estimated Total</span>
        <span className="text-2xl font-extrabold" style={{ color: brandColor }}>
          ${total.toLocaleString()}
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-gray-400">
        This is an estimate. Final price will be confirmed by your technician on-site.
      </p>

      <Button
        onClick={onRequest}
        disabled={isEmpty}
        className="mt-4 h-12 w-full rounded-full text-base font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: brandColor }}
      >
        Request Service
      </Button>
      {isEmpty ? (
        <p className="mt-2 text-center text-xs text-gray-400">Select at least one repair to continue.</p>
      ) : null}
    </div>
  )
}
