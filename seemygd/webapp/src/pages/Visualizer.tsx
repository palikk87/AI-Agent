import { useEffect, useMemo, useRef, useState } from "react"
import { useParams, Link, useSearchParams } from "react-router-dom"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { StyleWizard } from "@/components/garage/StyleWizard"
import { ResultViewer } from "@/components/garage/ResultViewer"
import { DesignHistory, type SavedDesign } from "@/components/garage/DesignHistory"
import { garageApi, type DoorSize, type GarageStyle, type SwapResult } from "@/lib/garage-api"
import { optimizeImageUrl, compressImageFile } from "@/lib/img"
import { useDocumentHead } from "@/hooks/useDocumentHead"
import type { JsonLd } from "@/lib/seo"
import { RepairEstimator } from "@/components/repair/RepairEstimator"
import { Phone, Mail, Sparkles, Wrench } from "lucide-react"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ""
function assetUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return url.startsWith("/uploads/") ? `${BACKEND_URL}${url}` : url
}

type CompanyBranding = {
  id: string
  businessName: string
  logoUrl: string | null
  heroImageUrl: string | null
  primaryColorHex: string
  contactPhone: string | null
  contactEmail: string | null
  websiteUrl: string | null
  subscriptionStatus: string
  tierType: string
  isPreview?: boolean
}

// Admin-only sales preview: branding is scraped live from a website via a
// signed, self-expiring token instead of loaded from a stored company.
export type PreviewParams = { site: string; expires: string; sig: string }

export default function Visualizer({
  companyId: companyIdProp,
  preview,
}: { companyId?: string; preview?: PreviewParams } = {}) {
  // Company can come from the /v/:companyId route param OR be injected when the
  // app is served on a customer's custom domain (resolved by hostname).
  const params = useParams<{ companyId: string }>()
  const companyId = companyIdProp ?? params.companyId

  // Tool toggle: "design" (visualizer) or "repair" (estimator). Synced to ?tool.
  const [searchParams, setSearchParams] = useSearchParams()
  const [tool, setTool] = useState<"design" | "repair">(
    searchParams.get("tool") === "repair" ? "repair" : "design"
  )
  const selectTool = (next: "design" | "repair") => {
    setTool(next)
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === "repair") p.set("tool", "repair")
        else p.delete("tool")
        return p
      },
      { replace: true }
    )
  }

  // Visualizer state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<GarageStyle | null>(null)
  const [selectedColorName, setSelectedColorName] = useState<string | undefined>(undefined)
  const [selectedWindowOption, setSelectedWindowOption] = useState<string | undefined>(undefined)
  const [result, setResult] = useState<SwapResult | null>(null)
  const [detectedDoorSize, setDetectedDoorSize] = useState<DoorSize | undefined>(undefined)
  const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>([])
  const [activeDesignId, setActiveDesignId] = useState<string | null>(null)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationElapsed, setGenerationElapsed] = useState(0)
  const resultRef = useRef<HTMLDivElement>(null)

  // Fetch branding via React Query (cached, non-blocking).
  // In preview mode we hit the signed preview endpoint (scraped, not stored).
  const brandingQuery = useQuery({
    queryKey: preview
      ? ["preview-branding", preview.site, preview.expires]
      : ["company-branding", companyId],
    queryFn: () =>
      preview
        ? api.get<CompanyBranding>(
            `/api/companies/preview-branding?site=${encodeURIComponent(preview.site)}` +
              `&expires=${encodeURIComponent(preview.expires)}&sig=${encodeURIComponent(preview.sig)}`
          )
        : api.get<CompanyBranding>(`/api/companies/${companyId}/branding`),
    enabled: preview ? true : !!companyId,
    staleTime: 5 * 60 * 1000, // cache 5 min
    retry: 1,
  })

  const company = brandingQuery.data ?? null
  const brandColor = company?.primaryColorHex ?? "#091F3B"
  // In preview mode there is no real company; never attach leads/repair to a tenant.
  const brandCompanyId = preview ? undefined : company?.id

  // Per-tenant SEO. When a subscriber's customer lands on the branded
  // visualizer (custom domain or /v/:slug), carry THAT business's name, phone
  // and structured data so it reinforces their brand and ranks for their name.
  useDocumentHead(
    useMemo(() => {
      if (!company) return null
      const name = company.businessName
      const phone = company.contactPhone || undefined
      const email = company.contactEmail || undefined
      const site = company.websiteUrl || undefined
      const shareImage =
        assetUrl(company.heroImageUrl) ?? assetUrl(company.logoUrl) ?? "/og-thumbnail.jpg"
      const pageUrl = typeof window !== "undefined" ? window.location.href : site

      const title = `Garage Door Visualizer — ${name}`
      const description = `See how a new garage door will look on your home before you buy. Free AI design tool from ${name}.${
        phone ? ` Call ${phone} for a quote.` : ""
      }`

      const business: JsonLd = {
        "@context": "https://schema.org",
        "@type": "HomeAndConstructionBusiness",
        name,
        ...(site ? { url: site } : {}),
        ...(phone ? { telephone: phone } : {}),
        ...(email ? { email } : {}),
        ...(assetUrl(company.logoUrl) ? { logo: assetUrl(company.logoUrl) } : {}),
        ...(shareImage ? { image: shareImage } : {}),
      }

      const tool: JsonLd = {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: `${name} Garage Door Visualizer`,
        applicationCategory: "DesignApplication",
        operatingSystem: "Web",
        ...(pageUrl ? { url: pageUrl } : {}),
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        provider: { "@type": "Organization", name },
      }

      return {
        title,
        description,
        themeColor: brandColor,
        image: shareImage,
        imageAlt: `${name} garage door visualizer`,
        ogType: "website",
        siteName: name,
        url: pageUrl,
        jsonLd: [business, tool],
      }
    }, [company, brandColor])
  )

  // Fetch catalog in parallel — independent of branding
  const catalogQuery = useQuery({
    queryKey: ["garage-catalog"],
    queryFn: garageApi.catalog,
    staleTime: Infinity,
  })

  // Whether this company offers the Repair Estimator. Defaults to on until the
  // setting loads; if the owner turned it off we hide the tool entirely.
  const repairPricingQuery = useQuery({
    queryKey: ["repair-pricing", companyId],
    queryFn: () => api.get<{ enabled: boolean }>(`/api/repair/${companyId}/pricing`),
    enabled: !preview && !!companyId,
    staleTime: 60 * 1000,
  })
  // The repair estimator needs per-company pricing, which a preview doesn't have,
  // so previews always show just the design tool.
  const repairEnabled = !preview && repairPricingQuery.data?.enabled !== false

  // If the estimator is off, never sit on the repair tool (e.g. via ?tool=repair).
  useEffect(() => {
    if (!repairEnabled && tool === "repair") setTool("design")
  }, [repairEnabled, tool])

  // Inject CSS brand color variables
  useEffect(() => {
    document.documentElement.style.setProperty("--brand-color", brandColor)
    const hex = brandColor.replace("#", "")
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    document.documentElement.style.setProperty("--brand-color-rgb", `${r}, ${g}, ${b}`)
    return () => {
      document.documentElement.style.removeProperty("--brand-color")
      document.documentElement.style.removeProperty("--brand-color-rgb")
    }
  }, [brandColor])

  const detectMutation = useMutation({
    mutationFn: (file: File) => garageApi.detect(file),
    onSuccess: (data) => setDetectedDoorSize(data),
  })

  useEffect(() => {
    if (!imageFile) { setImageUrl(null); return }
    const url = URL.createObjectURL(imageFile)
    setImageUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const swapMutation = useMutation({
    mutationFn: async ({ style, colorId, windowOptionId }: { style: GarageStyle; colorId?: string; windowOptionId?: string }) => {
      if (!imageFile) throw new Error("Photo required")
      return garageApi.swap(imageFile, style.id, colorId, windowOptionId)
    },
    onSuccess: (data) => {
      setGenerationProgress(100)
      setResult(data)
      if (data.detectedDoorSize) setDetectedDoorSize(data.detectedDoorSize)
      toast.success("Your new garage door is ready")
      const newDesign: SavedDesign = {
        id: crypto.randomUUID(),
        result: data,
        style: selectedStyle!,
        colorName: selectedColorName,
        windowOption: selectedWindowOption,
        manufacturerName: catalogQuery.data?.manufacturers.find((m) => m.id === selectedStyle?.manufacturer)?.name ?? "",
      }
      setSavedDesigns((prev) => [...prev, newDesign])
      setActiveDesignId(newDesign.id)
      setTimeout(() => { resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) }, 80)
    },
    onError: (err) => { toast.error(err instanceof Error ? err.message : "Something went wrong") },
  })

  useEffect(() => {
    if (!swapMutation.isPending) {
      if (swapMutation.isSuccess) { setGenerationProgress(100); setTimeout(() => setGenerationProgress(0), 1500) }
      return
    }
    setGenerationProgress(3)
    const interval = setInterval(() => {
      setGenerationProgress((prev) => {
        const multiplier = prev < 40 ? 0.12 : prev < 70 ? 0.07 : 0.03
        return Math.min(94, prev + (94 - prev) * multiplier)
      })
    }, 300)
    return () => clearInterval(interval)
  }, [swapMutation.isPending, swapMutation.isSuccess])

  useEffect(() => {
    if (!swapMutation.isPending) { setGenerationElapsed(0); return }
    setGenerationElapsed(0)
    const timer = setInterval(() => setGenerationElapsed((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [swapMutation.isPending])

  const handleFileChange = async (file: File | null) => {
    setResult(null)
    swapMutation.reset()
    if (!file) {
      setImageFile(null)
      setDetectedDoorSize(undefined)
      return
    }
    // Shrink big phone photos before upload/render so everything downstream
    // (upload, AI generation, before/after rendering) is fast.
    const optimized = await compressImageFile(file)
    setImageFile(optimized)
    detectMutation.mutate(optimized)
  }

  const handleGenerate = (style: GarageStyle, colorId?: string, windowOptionId?: string) => {
    if (!imageFile) { toast.error("Upload a photo of your home first"); return }
    setSelectedStyle(style)
    const effectiveColorId = colorId ?? style.colors[0]?.id
    const effectiveWindowId = windowOptionId ?? style.windowOptions[0]?.id
    setSelectedColorName(style.colors.find((c) => c.id === effectiveColorId)?.name)
    setSelectedWindowOption(style.windowOptions.find((w) => w.id === effectiveWindowId)?.name)
    setResult(null)
    swapMutation.mutate({ style, colorId, windowOptionId })
    setTimeout(() => { document.getElementById("viz-styles")?.scrollIntoView({ behavior: "smooth", block: "start" }) }, 50)
  }

  const handleReset = () => {
    setResult(null); setSelectedColorName(undefined); setSelectedWindowOption(undefined)
    setDetectedDoorSize(undefined); swapMutation.reset()
  }

  const handleChangePhoto = () => {
    setImageFile(null); setResult(null); setSelectedColorName(undefined)
    setSelectedWindowOption(undefined); setDetectedDoorSize(undefined)
    swapMutation.reset(); setSavedDesigns([]); setActiveDesignId(null)
  }

  const handleSelectDesign = (design: SavedDesign) => {
    setResult(design.result); setSelectedStyle(design.style)
    setSelectedColorName(design.colorName); setSelectedWindowOption(design.windowOption)
    setActiveDesignId(design.id)
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80)
  }

  const manufacturerName = useMemo(() => {
    if (!selectedStyle || !catalogQuery.data) return ""
    return catalogQuery.data.manufacturers.find((m) => m.id === selectedStyle.manufacturer)?.name ?? ""
  }, [selectedStyle, catalogQuery.data])

  // Show not-found only after query settled with no data
  if (brandingQuery.isError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-white text-xl font-semibold mb-2">Visualizer Not Found</h2>
          <p className="text-gray-400">This visualizer link may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  // Subscription gate — only show after branding is loaded (not during loading/error)
  if (brandingQuery.isSuccess && company?.subscriptionStatus !== "active") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Service Temporarily Unavailable</h1>
          <p className="text-gray-400">
            This visualizer is currently unavailable. Please contact the service provider.
          </p>
        </div>
      </div>
    )
  }

  // Downscale the (often huge, external) hero image — the biggest single
  // thing that slowed the visualizer down.
  const heroSrc = optimizeImageUrl(assetUrl(company?.heroImageUrl), 1280)

  return (
    <div className="min-h-screen bg-gray-950 relative">
      {/* Hero photo in its OWN fixed, full-viewport layer so it renders
          identically regardless of the scrolling content's height (each tool
          has a different height, which would otherwise make `cover` crop the
          same photo differently between the Design and Repair views). */}
      {heroSrc ? (
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{ backgroundImage: `url(${heroSrc})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      ) : null}
      {/* Full-page overlay — darkens image for readability, top-heavy gradient
          for text area. Sits above the photo layer. */}
      {heroSrc ? (
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.52) 35%, rgba(0,0,0,0.62) 100%)" }}
        />
      ) : null}

      {/* Preview ribbon — sales demo only, not shown for real client visualizers */}
      {preview ? (
        <div className="relative z-20 bg-amber-500 text-amber-950 text-center text-xs sm:text-sm font-semibold py-1.5 px-4">
          Sales preview · sample branding pulled from {preview.site} · link expires automatically
        </div>
      ) : null}

      {/* Header */}
      <header className="relative z-10 py-4 px-6 flex items-center justify-between shadow-lg transition-colors duration-300" style={{ backgroundColor: brandColor }}>
        <div className="flex items-center gap-3 min-w-0">
          {brandingQuery.isPending ? (
            <div className="h-8 w-32 rounded bg-white/20 animate-pulse" />
          ) : company?.logoUrl ? (
            <img src={assetUrl(company.logoUrl) ?? ""} alt={company?.businessName ?? ""} className="h-10 object-contain max-w-[160px]"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
          ) : (
            <span className="text-white font-bold text-xl truncate">{company?.businessName}</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-white/90 text-sm shrink-0">
          {company?.contactPhone ? (
            <a href={`tel:${company.contactPhone}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Phone className="w-4 h-4" />{company.contactPhone}
            </a>
          ) : null}
          {company?.contactEmail ? (
            <a href={`mailto:${company.contactEmail}`} className="hidden sm:flex items-center gap-1.5 hover:text-white transition-colors">
              <Mail className="w-4 h-4" />{company.contactEmail}
            </a>
          ) : null}
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6" id="viz-styles">
        {/* Tool toggle — big, obvious two-card switcher (only when the
            Repair Estimator is enabled; otherwise just show the designer). */}
        {repairEnabled ? (
        <div className="mb-8">
          <p className="mb-3 text-center text-sm font-semibold uppercase tracking-widest text-white/80 drop-shadow">
            What can we help you with today?
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([
              {
                id: "design" as const,
                label: "Design a New Door",
                sub: "See a new door on your home",
                icon: Sparkles,
              },
              {
                id: "repair" as const,
                label: "Estimate a Repair",
                sub: "Get a price to fix your door",
                icon: Wrench,
              },
            ]).map((seg) => {
              const active = tool === seg.id
              const Icon = seg.icon
              return (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => selectTool(seg.id)}
                  aria-pressed={active}
                  className={`group flex min-h-[68px] items-center gap-3 rounded-2xl border-2 px-5 py-4 text-left shadow-lg transition-all ${
                    active
                      ? "scale-[1.02] bg-white"
                      : "border-white/30 bg-white/10 backdrop-blur-sm hover:bg-white/20"
                  }`}
                  style={active ? { borderColor: brandColor } : {}}
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors"
                    style={
                      active
                        ? { backgroundColor: brandColor, color: "#fff" }
                        : { backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }
                    }
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span
                      className="block text-base font-bold leading-tight"
                      style={active ? { color: brandColor } : { color: "#fff" }}
                    >
                      {seg.label}
                    </span>
                    <span className={`block text-xs leading-tight ${active ? "text-gray-500" : "text-white/70"}`}>
                      {seg.sub}
                    </span>
                  </span>
                  {active ? (
                    <span
                      className="ml-auto hidden shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white sm:inline-block"
                      style={{ backgroundColor: brandColor }}
                    >
                      Selected
                    </span>
                  ) : (
                    <span className="ml-auto hidden shrink-0 text-xs font-semibold text-white/60 sm:inline-block">
                      Tap to switch →
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        ) : null}

        {repairEnabled && tool === "repair" ? (
          <RepairEstimator companyId={company?.id} brandColor={brandColor} company={company} />
        ) : (
        <>
        {!result ? (
          <div className="px-6 py-12 sm:px-10 sm:py-16 text-white text-center -mx-4 sm:-mx-6 mb-10">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-medium mb-5">
              ✨ Free AI Garage Door Visualizer
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold leading-tight mb-4 drop-shadow-lg">
              See your new garage door<br className="hidden sm:block" /> before you buy.
            </h1>
            <p className="text-white/85 text-base sm:text-lg max-w-lg mx-auto drop-shadow">
              Upload a photo of your home and instantly see how a new door would look — powered by AI.
            </p>
          </div>
        ) : null}

        {result ? (
          <div ref={resultRef}>
            <ResultViewer
              beforeUrl={imageUrl ?? ""}
              result={result}
              isGenerating={false}
              style={selectedStyle}
              manufacturerName={manufacturerName}
              onReset={handleReset}
              onChangePhoto={handleChangePhoto}
              colorName={selectedColorName}
              windowOption={selectedWindowOption}
              generationProgress={generationProgress}
              generationElapsed={generationElapsed}
              companyId={brandCompanyId}
              companyPhone={company?.contactPhone}
              companyName={company?.businessName}
            />
          </div>
        ) : catalogQuery.isLoading ? (
          <div className="aspect-[4/3] w-full animate-pulse overflow-hidden rounded-2xl bg-gray-800/70 sm:aspect-[16/10]" />
        ) : catalogQuery.data ? (
          <StyleWizard
            imageUrl={imageUrl}
            catalog={catalogQuery.data}
            onGenerate={handleGenerate}
            onChangePhoto={handleChangePhoto}
            onPhotoChange={handleFileChange}
            isGenerating={swapMutation.isPending}
            generationProgress={generationProgress}
            generationElapsed={generationElapsed}
            doorSize={detectedDoorSize}
            companyId={brandCompanyId}
            brandColor={brandColor}
          />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-10 text-center text-sm text-gray-300">
            Could not load the door catalog. Please refresh the page.
          </div>
        )}

        {/* 3-Step Cards */}
        {!result ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            {[
              { step: "1", icon: "📸", title: "Upload Your Photo", desc: "Take a picture of your home's exterior and upload it — any angle works." },
              { step: "2", icon: "🚪", title: "Choose Your Style", desc: "Browse real door styles, colors, and window options from top manufacturers." },
              { step: "3", icon: "💬", title: "Get a Free Quote", desc: "Love what you see? Request a quote directly and we'll reach out fast." },
            ].map((item) => (
              <div key={item.step} className="relative bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl transition-colors duration-300" style={{ backgroundColor: brandColor }} />
                <div className="text-3xl mb-3">{item.icon}</div>
                <div className="text-xs font-bold uppercase tracking-widest mb-1 transition-colors duration-300" style={{ color: brandColor }}>Step {item.step}</div>
                <div className="text-white font-semibold text-base mb-1">{item.title}</div>
                <div className="text-white/60 text-sm leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
        ) : null}

        {savedDesigns.length > 0 ? (
          <div className="mt-4">
            <DesignHistory
              designs={savedDesigns}
              activeId={activeDesignId}
              onSelect={handleSelectDesign}
              onClear={() => { setSavedDesigns([]); setActiveDesignId(null); setResult(null); swapMutation.reset() }}
              onAddNew={result ? handleReset : undefined}
            />
          </div>
        ) : null}
        </>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-bold text-white">
              {brandingQuery.isPending ? <span className="inline-block h-4 w-32 rounded bg-white/20 animate-pulse" /> : company?.businessName}
            </span>
            <div className="flex items-center gap-4 text-xs text-white/50">
              {company?.contactPhone ? (
                <a href={`tel:${company.contactPhone}`} className="hover:text-white transition-colors">{company.contactPhone}</a>
              ) : null}
              {company?.contactEmail ? (
                <a href={`mailto:${company.contactEmail}`} className="hover:text-white transition-colors">{company.contactEmail}</a>
              ) : null}
              <Link to="/legal" className="hover:text-white transition-colors">Disclaimer &amp; Privacy</Link>
            </div>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-white/40">
            Visualizations are AI-generated and meant only to give a general idea — not a literal portrayal.
            The AI may alter the door, other parts of your photo, colors, or details, and the real product
            and installed result may differ. Provided “as is” with no warranty; use at your own risk. See our{" "}
            <Link to="/legal" className="underline hover:text-white/70 transition-colors">Disclaimer &amp; Privacy Policy</Link>.
          </p>
        </div>
        {/* "Powered by" badge is stripped for Growth-tier (fully white-labeled) accounts. */}
        {company && company.tierType !== "growth" ? (
          <div className="text-center py-2 text-xs text-white/30 border-t border-white/5">
            Powered by{" "}
            <a href="/" className="hover:text-white/60 transition-colors">
              DoorViz Pro
            </a>
          </div>
        ) : null}
      </footer>

      {/* Backlink credit — visible on every client URL, plain <a>, no JS. */}
      <a
        href="https://seemygd.com"
        target="_blank"
        rel="noopener"
        className="fixed bottom-2 right-3 z-20 text-[11px] leading-none text-white/40 no-underline hover:underline hover:text-white/60 transition-colors"
      >
        Visualizer powered by Seemygd
      </a>
    </div>
  )
}
