import { useMemo, useState } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DoorConfig } from "../../../../backend/src/types"

type QuestionKey = keyof DoorConfig

interface OptionDef<V extends string> {
  value: V
  title: string
  helper: string
}

interface DoorInfoWizardProps {
  brandColor: string
  initial?: Partial<DoorConfig>
  onComplete: (config: DoorConfig) => void
}

const WIDTH_OPTIONS: OptionDef<DoorConfig["width"]>[] = [
  { value: "1car", title: "1-Car Door", helper: "About 8–9 ft wide — fits a single vehicle." },
  { value: "2car", title: "2-Car Door", helper: "About 16–18 ft wide — fits two vehicles." },
]

const HEIGHT_OPTIONS: OptionDef<DoorConfig["height"]>[] = [
  { value: "standard", title: "Standard", helper: "7 ft tall — the most common height." },
  { value: "tall", title: "Extra Tall", helper: "8 ft or more — trucks, RVs, high garages." },
]

const INSULATION_OPTIONS: OptionDef<DoorConfig["insulation"]>[] = [
  { value: "hollow", title: "Hollow", helper: "No insulation — you can see the metal ribs inside." },
  { value: "vinyl", title: "Vinyl Back", helper: "White plastic backing on the inside." },
  { value: "steel", title: "Steel Back", helper: "Solid steel backing — heaviest, best insulated." },
]

// Order the wizard walks through.
const STEPS: { key: QuestionKey; question: string; helper: string }[] = [
  { key: "width", question: "How wide is your garage door?", helper: "Not sure? Count how many cars it covers." },
  { key: "height", question: "How tall is your garage door?", helper: "Most homes have a standard 7-foot door." },
  { key: "insulation", question: "What is the door made of?", helper: "Look at the inside of the door for a clue." },
  { key: "springs", question: "What kind of springs does it have?", helper: "Peek at the inside — the pictures below make it easy." },
]

function OptionCard<V extends string>({
  option,
  selected,
  brandColor,
  onSelect,
}: {
  option: OptionDef<V>
  selected: boolean
  brandColor: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex w-full flex-col items-start rounded-2xl border-2 p-4 text-left transition-all min-h-[44px]",
        "hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        selected ? "shadow-md" : "border-gray-200 bg-white"
      )}
      style={
        selected
          ? { borderColor: brandColor, backgroundColor: `rgba(var(--brand-color-rgb), 0.06)` }
          : {}
      }
    >
      {selected ? (
        <span
          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: brandColor }}
        >
          <Check className="h-4 w-4" />
        </span>
      ) : null}
      <span className="text-base font-semibold text-gray-900">{option.title}</span>
      <span className="mt-1 text-sm leading-snug text-gray-500">{option.helper}</span>
    </button>
  )
}

/** Simple inline illustrations so a homeowner can identify their spring type. */
function SpringIllustration({ type, brandColor }: { type: DoorConfig["springs"]; brandColor: string }) {
  if (type === "torsion") {
    return (
      <svg viewBox="0 0 120 90" className="h-24 w-full" role="img" aria-label="Torsion spring above the door">
        {/* torsion bar + spring above door */}
        <line x1="14" y1="20" x2="106" y2="20" stroke="#9ca3af" strokeWidth="2" />
        <rect x="40" y="14" width="40" height="12" rx="6" fill="none" stroke={brandColor} strokeWidth="3" />
        {[44, 50, 56, 62, 68, 74].map((x) => (
          <line key={x} x1={x} y1="14" x2={x + 4} y2="26" stroke={brandColor} strokeWidth="2" />
        ))}
        {/* door below */}
        <rect x="24" y="30" width="72" height="52" rx="3" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="2" />
        <line x1="24" y1="43" x2="96" y2="43" stroke="#d1d5db" strokeWidth="1.5" />
        <line x1="24" y1="56" x2="96" y2="56" stroke="#d1d5db" strokeWidth="1.5" />
        <line x1="24" y1="69" x2="96" y2="69" stroke="#d1d5db" strokeWidth="1.5" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 120 90" className="h-24 w-full" role="img" aria-label="Extension springs on the sides">
      {/* door in middle */}
      <rect x="36" y="16" width="48" height="66" rx="3" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="2" />
      <line x1="36" y1="32" x2="84" y2="32" stroke="#d1d5db" strokeWidth="1.5" />
      <line x1="36" y1="49" x2="84" y2="49" stroke="#d1d5db" strokeWidth="1.5" />
      <line x1="36" y1="66" x2="84" y2="66" stroke="#d1d5db" strokeWidth="1.5" />
      {/* side springs */}
      {[22, 98].map((x) => (
        <g key={x}>
          <line x1={x} y1="16" x2={x} y2="82" stroke="#9ca3af" strokeWidth="2" />
          {[24, 32, 40, 48, 56, 64, 72].map((y) => (
            <line key={y} x1={x - 5} y1={y} x2={x + 5} y2={y + 4} stroke={brandColor} strokeWidth="2" />
          ))}
        </g>
      ))}
    </svg>
  )
}

export function DoorInfoWizard({ brandColor, initial, onComplete }: DoorInfoWizardProps) {
  const [config, setConfig] = useState<Partial<DoorConfig>>(initial ?? {})

  // Index of the first unanswered step — that's the one we surface prominently.
  const currentStepIndex = useMemo(() => {
    const idx = STEPS.findIndex((s) => config[s.key] === undefined)
    return idx === -1 ? STEPS.length - 1 : idx
  }, [config])

  const answeredCount = STEPS.filter((s) => config[s.key] !== undefined).length
  const allAnswered =
    config.width !== undefined &&
    config.height !== undefined &&
    config.insulation !== undefined &&
    config.springs !== undefined

  const select = <K extends QuestionKey>(key: K, value: DoorConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white p-5 shadow-xl sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Tell us about your door</h2>
          <p className="mt-1 text-sm text-gray-500">4 quick questions — no measuring required.</p>
        </div>
        <span
          className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ backgroundColor: brandColor }}
        >
          {Math.min(answeredCount + (allAnswered ? 0 : 1), STEPS.length)} of {STEPS.length}
        </span>
      </div>

      <div className="space-y-7">
        {STEPS.map((step, i) => {
          const isVisible = i <= currentStepIndex || config[step.key] !== undefined
          if (!isVisible) return null
          return (
            <div key={step.key}>
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: brandColor }}
                >
                  {i + 1}
                </span>
                <h3 className="text-base font-semibold text-gray-900">{step.question}</h3>
              </div>
              <p className="mb-3 pl-8 text-sm text-gray-500">{step.helper}</p>

              {step.key === "width" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {WIDTH_OPTIONS.map((o) => (
                    <OptionCard
                      key={o.value}
                      option={o}
                      brandColor={brandColor}
                      selected={config.width === o.value}
                      onSelect={() => select("width", o.value)}
                    />
                  ))}
                </div>
              ) : null}

              {step.key === "height" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {HEIGHT_OPTIONS.map((o) => (
                    <OptionCard
                      key={o.value}
                      option={o}
                      brandColor={brandColor}
                      selected={config.height === o.value}
                      onSelect={() => select("height", o.value)}
                    />
                  ))}
                </div>
              ) : null}

              {step.key === "insulation" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {INSULATION_OPTIONS.map((o) => (
                    <OptionCard
                      key={o.value}
                      option={o}
                      brandColor={brandColor}
                      selected={config.insulation === o.value}
                      onSelect={() => select("insulation", o.value)}
                    />
                  ))}
                </div>
              ) : null}

              {step.key === "springs" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(["torsion", "extension"] as const).map((value) => {
                    const selected = config.springs === value
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => select("springs", value)}
                        className={cn(
                          "relative flex flex-col items-center rounded-2xl border-2 p-4 transition-all",
                          "hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                          selected ? "shadow-md" : "border-gray-200 bg-white"
                        )}
                        style={
                          selected
                            ? { borderColor: brandColor, backgroundColor: `rgba(var(--brand-color-rgb), 0.06)` }
                            : {}
                        }
                      >
                        {selected ? (
                          <span
                            className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: brandColor }}
                          >
                            <Check className="h-4 w-4" />
                          </span>
                        ) : null}
                        <SpringIllustration type={value} brandColor={brandColor} />
                        <span className="mt-2 text-base font-semibold text-gray-900">
                          {value === "torsion" ? "Torsion (Above Door)" : "Extension (On the Sides)"}
                        </span>
                        <span className="mt-1 text-center text-sm leading-snug text-gray-500">
                          {value === "torsion"
                            ? "A single spring on a bar above the door."
                            : "Long springs along the tracks on each side."}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {allAnswered ? (
        <button
          type="button"
          onClick={() =>
            onComplete({
              width: config.width!,
              height: config.height!,
              insulation: config.insulation!,
              springs: config.springs!,
            })
          }
          className="mt-7 min-h-[52px] w-full rounded-full text-base font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: brandColor }}
        >
          See My Repair Options →
        </button>
      ) : null}
    </div>
  )
}
