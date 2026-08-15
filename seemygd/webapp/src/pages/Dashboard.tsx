import { useState, useEffect } from "react"
import { CREDIT_FIXED_STYLE, creditAnchorHtml } from "@/lib/credit"
import type { Area } from "react-easy-crop"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { CheckoutDialog } from "@/components/CheckoutDialog"
import { HeroCropDialog } from "@/components/HeroCropDialog"
import { getCroppedImg } from "@/lib/crop-image"
import { signOut, getAuthToken } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import {
  LayoutDashboard,
  Palette,
  Users,
  LogOut,
  Link2,
  Copy,
  CheckCircle,
  ExternalLink,
  Phone,
  Mail,
  Loader2,
  Sparkles,
  TrendingUp,
  Clock,
  Settings,
  Eye,
  EyeOff,
  Upload,
  CreditCard,
  Lock,
  Star,
  Zap,
  XCircle,
  Globe,
  Wrench,
} from "lucide-react"
import {
  REPAIR_CATALOG,
  REPAIR_PARTS,
  computeRepairPrice,
  type DoorConfig,
  type RepairMultipliers,
  type RepairSettingsResponse,
} from "../../../backend/src/types"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ""

type DashSection = "overview" | "leads" | "customize" | "account" | "repair"

type Company = {
  id: string
  businessName: string
  logoUrl: string | null
  heroImageUrl: string | null
  primaryColorHex: string
  contactPhone: string | null
  contactEmail: string | null
  websiteUrl: string | null
  subscriptionStatus: string
  notificationEmail: string | null
  resendApiKey: string | null
  resendFromEmail: string | null
  tierType: string
  vanitySlug: string | null
  customDomain: string | null
  individualUrlEnabled: boolean
  squareCustomerId: string | null
  squareSubscriptionId: string | null
}

type Lead = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  zipCode: string | null
  styleName: string | null
  colorName: string | null
  manufacturerName: string | null
  windowOption: string | null
  notes: string | null
  source: string | null
  status: string
  createdAt: string
  beforeImageBase64: string | null
  afterImageBase64: string | null
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [company, setCompany] = useState<Company | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailSaved, setEmailSaved] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<DashSection>("overview")
  const [subscribing] = useState<"starter" | "growth" | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [checkoutTier, setCheckoutTier] = useState<"starter" | "growth">("starter")
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false)

  // Customize edit state
  const [businessName, setBusinessName] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [heroImageUrl, setHeroImageUrl] = useState("")
  const [primaryColor, setPrimaryColor] = useState("#091F3B")
  const [contactPhone, setContactPhone] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [scraping, setScraping] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingHero, setUploadingHero] = useState(false)

  // Hero crop dialog state. When the owner picks a hero file we open a cropper
  // (16:9) and only run the upload once they confirm the framing.
  const [heroCropOpen, setHeroCropOpen] = useState(false)
  const [heroCropSrc, setHeroCropSrc] = useState<string | null>(null)

  // Email settings state
  const [notificationEmail, setNotificationEmail] = useState("")
  const [resendApiKey, setResendApiKey] = useState("")
  const [resendFromEmail, setResendFromEmail] = useState("")

  // Vanity slug state
  const [vanitySlug, setVanitySlug] = useState("")
  const [savingSlug, setSavingSlug] = useState(false)
  const [slugStatus, setSlugStatus] = useState<{
    checking: boolean
    available: boolean | null
    reason: string | null
  }>({ checking: false, available: null, reason: null })

  // Growth settings state
  const [customDomain, setCustomDomain] = useState("")
  const [savingGrowth, setSavingGrowth] = useState(false)

  // Repair pricing state
  const [repairMultipliers, setRepairMultipliers] = useState<RepairMultipliers>({
    twoCarMultiplier: 1.6,
    tallMultiplier: 1.15,
    vinylMultiplier: 1.15,
    steelMultiplier: 1.35,
    serviceCallFee: 0,
  })
  const [repairPrices, setRepairPrices] = useState<Record<string, number>>({})
  const [repairEnabled, setRepairEnabled] = useState(true)
  const [savingRepair, setSavingRepair] = useState(false)
  const [togglingRepair, setTogglingRepair] = useState(false)

  function applyCompany(comp: Company) {
    setCompany(comp)
    setBusinessName(comp.businessName ?? "")
    setLogoUrl(comp.logoUrl ?? "")
    setHeroImageUrl(comp.heroImageUrl ?? "")
    setPrimaryColor(comp.primaryColorHex ?? "#091F3B")
    setContactPhone(comp.contactPhone ?? "")
    setContactEmail(comp.contactEmail ?? "")
    setWebsiteUrl(comp.websiteUrl ?? "")
    setNotificationEmail(comp.notificationEmail ?? "")
    setResendApiKey(comp.resendApiKey ?? "")
    setResendFromEmail(comp.resendFromEmail ?? "")
    setVanitySlug(comp.vanitySlug ?? "")
    setCustomDomain(comp.customDomain ?? "")
  }

  function applyRepairSettings(settings: RepairSettingsResponse) {
    setRepairEnabled(settings.enabled)
    setRepairMultipliers(settings.multipliers)
    const priceMap: Record<string, number> = {}
    for (const p of settings.prices) priceMap[p.repairKey] = p.basePrice
    setRepairPrices(priceMap)
  }

  // Turn the Repair Estimator on/off — applied immediately so owners see it
  // take effect without hunting for a save button.
  async function toggleRepairEnabled(next: boolean) {
    const prev = repairEnabled
    setRepairEnabled(next) // optimistic
    setTogglingRepair(true)
    try {
      const updated = await api.put<RepairSettingsResponse>("/api/repair/settings", { enabled: next })
      applyRepairSettings(updated)
      toast.success(next ? "Repair Estimator turned on" : "Repair Estimator turned off")
    } catch {
      setRepairEnabled(prev) // revert on failure
      toast.error("Couldn't update the Repair Estimator")
    } finally {
      setTogglingRepair(false)
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const [comp, leadsData, repairSettings] = await Promise.all([
          api.get<Company>("/api/companies/me"),
          api.get<Lead[]>("/api/leads"),
          api.get<RepairSettingsResponse>("/api/repair/settings").catch(() => null),
        ])
        applyCompany(comp)
        setLeads(leadsData)
        if (repairSettings) applyRepairSettings(repairSettings)
      } catch {
        // Admin users have no company — send them to admin portal
        try {
          await api.get("/api/admin/me")
          navigate("/admin")
        } catch {
          navigate("/login")
        }
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  // Live availability check for the vanity slug (debounced).
  useEffect(() => {
    const next = vanitySlug.trim().toLowerCase()
    // No check needed for empty input or the slug already saved to this company.
    if (!next || next === (company?.vanitySlug ?? "")) {
      setSlugStatus({ checking: false, available: null, reason: null })
      return
    }
    setSlugStatus({ checking: true, available: null, reason: null })
    const handle = setTimeout(async () => {
      try {
        const res = await api.get<{ available: boolean; reason: string | null }>(
          `/api/companies/slug-available?slug=${encodeURIComponent(next)}`
        )
        setSlugStatus({ checking: false, available: res.available, reason: res.reason })
      } catch {
        setSlugStatus({ checking: false, available: null, reason: null })
      }
    }, 400)
    return () => clearTimeout(handle)
  }, [vanitySlug, company?.vanitySlug])

  const isFree = company?.tierType === "free"
  const isActive = company?.subscriptionStatus === "active" || isFree
  // Free is an admin-granted comp plan → full (Growth-level) access.
  const isGrowth = company?.tierType === "growth" || isFree
  // Individualized visualizer URL (/v/:slug) is grandfathered for existing
  // clients only. New clients don't get it — they use the embed code instead.
  const showIndividualUrl = !!company?.individualUrlEnabled
  // Prefer the clean vanity slug; fall back to the id if none is set yet.
  const visualizerHandle = company?.vanitySlug || company?.id || ""
  const visualizerUrl = company ? `${window.location.origin}/v/${visualizerHandle}` : ""

  // Embed snippets shown in the dashboard.
  const popupSnippet = company
    ? `<!-- Visualize My Door popup button -->\n<script src="${window.location.origin}/embed.js" data-slug="${visualizerHandle}" defer></script>\n<!-- Credit link kept as static HTML so search engines can crawl it (embed.js adopts it and keeps it nofollowed) -->\n${creditAnchorHtml({ withId: true, style: CREDIT_FIXED_STYLE })}`
    : ""
  const iframeSnippet = company
    ? `<!-- Garage Door Visualizer — full-width embed -->\n<div style="max-width:1400px;margin:0 auto;">\n  <iframe\n    src="${visualizerUrl}"\n    title="Garage Door Visualizer"\n    loading="lazy"\n    allow="camera; clipboard-write"\n    style="width:100%;min-height:1100px;height:88vh;display:block;border:0;border-radius:16px;"\n  ></iframe>\n  <div style="text-align:right;padding:4px 4px 0;">\n    ${creditAnchorHtml({ style: "font-size:11px;color:#9ca3af;text-decoration:none;" })}\n  </div>\n</div>`
    : ""

  function copyUrl() {
    navigator.clipboard.writeText(visualizerUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000)
  }

  async function saveSlug(e: React.FormEvent) {
    e.preventDefault()
    const next = vanitySlug.trim().toLowerCase()
    if (next && slugStatus.available === false) {
      toast.error(slugStatus.reason ?? "That link isn't available")
      return
    }
    setSavingSlug(true)
    try {
      const updated = await api.put<Company>("/api/companies/me", { vanitySlug: next })
      applyCompany(updated)
      setSlugStatus({ checking: false, available: null, reason: null })
      toast.success(next ? "Visualizer link updated" : "Custom link cleared")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save link")
    } finally {
      setSavingSlug(false)
    }
  }

  async function saveBranding(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await api.put<Company>("/api/companies/me", {
        businessName: businessName || undefined,
        logoUrl: logoUrl || undefined,
        heroImageUrl: heroImageUrl || undefined,
        primaryColorHex: primaryColor,
        contactPhone: contactPhone || undefined,
        contactEmail: contactEmail || undefined,
        websiteUrl: websiteUrl || undefined,
      })
      setCompany(updated)
      toast.success("Branding saved successfully")
    } catch {
      toast.error("Failed to save branding")
    } finally {
      setSaving(false)
    }
  }

  // Crawl the owner's website and pre-fill logo, colors, hero image and contact
  // info. Fields are populated for review — the owner still clicks Save Branding.
  async function scrapeFromWebsite() {
    if (!websiteUrl.trim()) {
      toast.error("Enter your website address first")
      return
    }
    setScraping(true)
    try {
      const scraped = await api.post<{
        logoUrl: string | null
        primaryColorHex: string | null
        contactPhone: string | null
        contactEmail: string | null
        heroImageUrl: string | null
      }>("/api/onboard/scrape-brand", { websiteUrl })

      let found = 0
      if (scraped.logoUrl) { setLogoUrl(scraped.logoUrl); found++ }
      if (scraped.heroImageUrl) { setHeroImageUrl(scraped.heroImageUrl); found++ }
      if (scraped.primaryColorHex) { setPrimaryColor(scraped.primaryColorHex); found++ }
      if (scraped.contactPhone && !contactPhone) { setContactPhone(scraped.contactPhone); found++ }
      if (scraped.contactEmail && !contactEmail) { setContactEmail(scraped.contactEmail); found++ }

      if (found > 0) {
        toast.success("Pulled your branding — review it below, then Save.")
      } else {
        toast.message("Couldn't detect branding automatically. Add it manually below.")
      }
    } catch {
      toast.error("Couldn't reach that website. Check the address and try again.")
    } finally {
      setScraping(false)
    }
  }

  async function compressImage(file: File, maxWidth: number, quality: number): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], "image.jpg", { type: "image/jpeg" }) : file),
          "image/jpeg",
          quality
        )
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
      img.src = url
    })
  }

  async function uploadImage(file: File, type: "logo" | "hero"): Promise<string | null> {
    const maxWidth = type === "logo" ? 400 : 1200
    const compressed = await compressImage(file, maxWidth, 0.82)
    const form = new FormData()
    form.append("file", compressed)
    form.append("type", type)
    const token = getAuthToken()
    const res = await fetch(`${BACKEND_URL}/api/companies/me/upload-image`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    const json = await res.json()
    return json.data?.url ?? null
  }

  async function handleLogoUpload(file: File | undefined) {
    if (!file) return
    setUploadingLogo(true)
    try {
      const url = await uploadImage(file, "logo")
      if (url) setLogoUrl(url)
    } catch {
      toast.error("Failed to upload logo")
    } finally {
      setUploadingLogo(false)
    }
  }

  // Step 1: user picked a file — open the crop dialog to frame it (16:9).
  // Nothing is uploaded until they confirm.
  function handleHeroUpload(file: File | undefined) {
    if (!file) return
    const src = URL.createObjectURL(file)
    setHeroCropSrc(src)
    setHeroCropOpen(true)
  }

  function closeHeroCrop() {
    setHeroCropOpen(false)
    if (heroCropSrc) URL.revokeObjectURL(heroCropSrc)
    setHeroCropSrc(null)
  }

  // Cancel — no upload; the file input was already reset on selection so the
  // same file can be re-picked.
  function handleHeroCropCancel() {
    if (uploadingHero) return
    closeHeroCrop()
  }

  // Step 2: user confirmed the crop — build the cropped JPEG and feed it to the
  // existing upload flow (which runs the server-side AI cleanup).
  async function handleHeroCropConfirm(croppedAreaPixels: Area) {
    if (!heroCropSrc) return
    setUploadingHero(true)
    const toastId = toast.loading("Cleaning up your background photo with AI — this can take up to a minute...")
    try {
      const cropped = await getCroppedImg(heroCropSrc, croppedAreaPixels)
      const url = await uploadImage(cropped, "hero")
      if (url) setHeroImageUrl(url)
      toast.success("Background photo enhanced", { id: toastId })
      closeHeroCrop()
    } catch {
      toast.error("Failed to upload hero image", { id: toastId })
    } finally {
      setUploadingHero(false)
    }
  }

  async function saveEmailSettings(e: React.FormEvent) {
    e.preventDefault()
    setSavingEmail(true)
    try {
      const updated = await api.put<Company>("/api/companies/me", {
        resendApiKey: resendApiKey || undefined,
        resendFromEmail: resendFromEmail || undefined,
        notificationEmail: notificationEmail,
      })
      setCompany(updated)
      setEmailSaved(true)
      setTimeout(() => setEmailSaved(false), 3000)
      toast.success("Email settings saved")
    } catch {
      toast.error("Failed to save email settings")
    } finally {
      setSavingEmail(false)
    }
  }

  async function saveGrowthSettings(e: React.FormEvent) {
    e.preventDefault()
    setSavingGrowth(true)
    try {
      const updated = await api.put<Company>("/api/companies/me", {
        customDomain: customDomain || undefined,
      })
      setCompany(updated)
      toast.success("Growth settings saved")
    } catch {
      toast.error("Failed to save settings")
    } finally {
      setSavingGrowth(false)
    }
  }

  function basePriceFor(repairKey: string, fallback: number): number {
    return repairPrices[repairKey] ?? fallback
  }

  async function saveRepairSettings(e: React.FormEvent) {
    e.preventDefault()
    setSavingRepair(true)
    try {
      const updated = await api.put<RepairSettingsResponse>("/api/repair/settings", {
        enabled: repairEnabled,
        twoCarMultiplier: repairMultipliers.twoCarMultiplier,
        tallMultiplier: repairMultipliers.tallMultiplier,
        vinylMultiplier: repairMultipliers.vinylMultiplier,
        steelMultiplier: repairMultipliers.steelMultiplier,
        serviceCallFee: repairMultipliers.serviceCallFee,
        prices: REPAIR_CATALOG.map((r) => ({
          repairKey: r.key,
          basePrice: basePriceFor(r.key, r.defaultBasePrice),
        })),
      })
      applyRepairSettings(updated)
      toast.success("Repair pricing saved")
    } catch {
      toast.error("Failed to save repair pricing")
    } finally {
      setSavingRepair(false)
    }
  }

  function handleSubscribe(tier: "starter" | "growth") {
    setCheckoutTier(tier)
    setCheckoutDialogOpen(true)
  }

  // Charges the card token via Square. Only resolves (and activates) if Square
  // confirms the payment — otherwise it throws and the dialog shows the error.
  async function handlePay(sourceId: string) {
    await api.post("/api/square/pay", { tier: checkoutTier, sourceId })
    const refreshed = await api.get<Company>("/api/companies/me")
    applyCompany(refreshed)
    setCheckoutDialogOpen(false)
    toast.success("Payment successful! Your subscription is now active.")
  }

  async function handleCancelSubscription() {
    setCanceling(true)
    try {
      await api.post("/api/square/cancel-subscription")
      const updated = await api.get<Company>("/api/companies/me")
      setCompany(updated)
      toast.success("Subscription canceled")
    } catch {
      toast.error("Failed to cancel subscription")
    } finally {
      setCanceling(false)
    }
  }

  async function markContacted(leadId: string) {
    setUpdatingLeadId(leadId)
    try {
      const updated = await api.patch<Lead>(`/api/leads/${leadId}`, { status: "contacted" })
      setLeads(prev => prev.map(l => l.id === leadId ? updated : l))
    } finally {
      setUpdatingLeadId(null)
    }
  }

  function handleSignOut() {
    signOut()
    navigate("/login")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  const tierLabel = isFree ? "Free" : company?.tierType === "growth" ? "Growth" : "Starter"
  const tierAmount = isFree ? "$0" : company?.tierType === "growth" ? "$99" : "$49"
  const newLeadsCount = leads.filter(l => l.status === "new").length

  const navItems: { id: DashSection; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "leads", label: "Leads", icon: Users, badge: newLeadsCount > 0 ? newLeadsCount : undefined },
    { id: "customize", label: "Customize", icon: Palette },
    { id: "repair", label: "Repair Pricing", icon: Wrench },
    { id: "account", label: "Account", icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-card border-b md:border-b-0 md:border-r border-border flex flex-col md:min-h-screen md:sticky md:top-0 md:h-screen">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl.startsWith("/uploads/") ? `${BACKEND_URL}${logoUrl}` : logoUrl}
                className="w-8 h-8 rounded object-contain bg-muted shrink-0"
                alt="Logo"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
              />
            ) : (
              <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {(company?.businessName ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground truncate max-w-[140px]">
                {company?.businessName ?? "Your Business"}
              </div>
              <div className="text-xs text-muted-foreground">DoorViz Pro</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="md:hidden text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>

        {/* Visualizer URL — desktop only, active clients with an individual URL */}
        {isActive && showIndividualUrl ? (
          <div className="hidden md:block p-3 border-b border-border shrink-0">
            <div className="text-xs text-muted-foreground mb-1.5">Your Visualizer</div>
            <div className="flex items-center gap-2 bg-muted rounded-lg px-2.5 py-2">
              <Link2 className="w-3 h-3 text-primary shrink-0" />
              <code className="text-xs text-primary truncate flex-1">
                {visualizerUrl.replace("https://", "").replace("http://", "")}
              </code>
              <button onClick={copyUrl} className="shrink-0" type="button">
                {copied ? (
                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground transition-colors" />
                )}
              </button>
            </div>
          </div>
        ) : null}

        {/* Nav */}
        <nav className="p-3 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible shrink-0">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap w-auto md:w-full text-left ${
                activeSection === item.id
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
              {item.badge !== undefined ? (
                <Badge className="ml-auto bg-primary text-primary-foreground text-xs py-0 px-1.5 min-w-[20px] text-center">
                  {item.badge}
                </Badge>
              ) : null}
            </button>
          ))}
        </nav>

        {/* Spacer — pushes status and sign out to bottom on desktop */}
        <div className="hidden md:block flex-1" />

        {/* Status badges — desktop only */}
        <div className="hidden md:flex p-4 border-t border-border gap-2 flex-wrap shrink-0">
          <Badge
            className={
              isActive
                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                : "bg-secondary text-muted-foreground border border-border"
            }
          >
            {isActive ? (
              <CheckCircle className="w-3 h-3 mr-1" />
            ) : (
              <XCircle className="w-3 h-3 mr-1" />
            )}
            {company?.subscriptionStatus ?? "trial"}
          </Badge>
          {isActive ? (
            <Badge className="bg-primary/10 text-primary border border-primary/30">
              {tierLabel}
            </Badge>
          ) : null}
        </div>

        {/* Sign Out — desktop only */}
        <div className="hidden md:flex p-4 border-t border-border shrink-0">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
          {/* OVERVIEW */}
          {activeSection === "overview" ? (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-3xl tracking-tight text-foreground">
                  Welcome back, {company?.businessName}
                </h1>
                <p className="text-muted-foreground mt-1">Here's your visualizer overview</p>
              </div>

              {/* Activation banner for unpaid users */}
              {!isActive ? (
                <div className="rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-primary font-semibold mb-1 flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Complete your setup to go live
                    </div>
                    <p className="text-foreground/70 text-sm">
                      Choose a plan to publish your visualizer and start capturing leads.
                    </p>
                  </div>
                  <Button
                    onClick={() => setActiveSection("account")}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Choose a Plan
                  </Button>
                </div>
              ) : null}

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-8 h-8 text-primary" />
                      <div>
                        <div className="text-2xl font-bold text-foreground">{leads.length}</div>
                        <div className="text-sm text-muted-foreground">Total Leads</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <Clock className="w-8 h-8 text-emerald-600" />
                      <div>
                        <div className="text-2xl font-bold text-foreground">
                          {leads.filter((l) => l.status === "new").length}
                        </div>
                        <div className="text-sm text-muted-foreground">New This Week</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <Users className="w-8 h-8 text-violet-600" />
                      <div>
                        <div className="text-2xl font-bold text-foreground">
                          {leads.filter((l) => l.status === "contacted").length}
                        </div>
                        <div className="text-sm text-muted-foreground">Contacted</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Plan card for active users */}
              {isActive ? (
                <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
                  <CardContent className="p-4 flex items-center gap-3">
                    {company?.tierType === "growth" ? (
                      <Zap className="w-5 h-5 text-amber-600" />
                    ) : (
                      <Star className="w-5 h-5 text-primary" />
                    )}
                    <div>
                      <span className="text-foreground font-semibold">{tierLabel} Plan</span>
                      <span className="text-muted-foreground text-sm ml-2">{tierAmount}/month</span>
                    </div>
                    {company?.tierType === "growth" ? (
                      <Badge className="ml-auto bg-amber-500/15 text-amber-600 border border-amber-500/30">
                        White-labeled
                      </Badge>
                    ) : (
                      <Badge className="ml-auto bg-primary/10 text-primary border border-primary/30">
                        Branded
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {/* Visualizer URL card — active only */}
              {isActive ? (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Link2 className="w-5 h-5 text-primary" />
                      {showIndividualUrl ? "Your Visualizer URL" : "Embed on Your Website"}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {showIndividualUrl
                        ? "Share this URL or embed it on your website to let customers visualize garage doors with your branding."
                        : "Add the visualizer to your website with a single snippet — it opens in a popup with your branding."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {showIndividualUrl ? (
                    <div className="flex items-center gap-3 bg-muted rounded-lg p-4">
                      <code className="flex-1 text-primary text-sm break-all">{visualizerUrl}</code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyUrl}
                        className="shrink-0 border-border text-foreground/80 hover:bg-secondary"
                      >
                        {copied ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="shrink-0 border-border text-foreground/80 hover:bg-secondary"
                      >
                        <a href={visualizerUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>
                    ) : null}
                    {/* Popup button snippet — available on every plan */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-foreground text-sm font-medium">
                          Popup button (paste on any page)
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyText(popupSnippet, "popup")}
                          className="h-7 border-border text-foreground/80 hover:bg-secondary"
                        >
                          {copiedKey === "popup" ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <><Copy className="w-3.5 h-3.5 mr-1" />Copy</>
                          )}
                        </Button>
                      </div>
                      <div className="bg-muted rounded-lg p-4">
                        <code className="text-emerald-600 text-xs break-all whitespace-pre-wrap">
                          {popupSnippet}
                        </code>
                      </div>
                      <p className="text-muted-foreground text-xs mt-2">
                        Adds a floating “Visualize My Door” button that opens your visualizer in a
                        popup. To use your own button instead, add{" "}
                        <code className="text-foreground/70">&lt;button data-doorviz&gt;</code> anywhere
                        on the page.
                      </p>
                    </div>

                    {/* Raw iframe embed — Growth tier only, and only for clients
                        that still have their individualized URL (it embeds /v/…). */}
                    {!showIndividualUrl ? null : isGrowth ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-foreground text-sm font-medium flex items-center gap-2">
                            Inline embed
                            <Badge className="bg-amber-500/15 text-amber-600 border border-amber-500/30 text-[10px]">
                              Growth
                            </Badge>
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyText(iframeSnippet, "iframe")}
                            className="h-7 border-border text-foreground/80 hover:bg-secondary"
                          >
                            {copiedKey === "iframe" ? (
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <><Copy className="w-3.5 h-3.5 mr-1" />Copy</>
                            )}
                          </Button>
                        </div>
                        <div className="bg-muted rounded-lg p-4">
                          <code className="text-emerald-600 text-xs break-all">{iframeSnippet}</code>
                        </div>
                        <p className="text-muted-foreground text-xs mt-2">
                          Embeds the full-size, responsive visualizer directly inside a page on your
                          site — it stretches to the page width (up to 1400px) and stands ~1100px
                          tall so customers get a roomy, app-like experience.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border p-4 flex items-start gap-3">
                        <Lock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-foreground text-sm font-medium">Inline iframe embed</p>
                          <p className="text-muted-foreground text-xs mt-1">
                            Embed the visualizer natively inside a webpage. Available on the Growth
                            plan.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {/* Recent Leads */}
              {leads.slice(0, 3).length > 0 ? (
                <Card className="bg-card border-border">
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-foreground">Recent Leads</CardTitle>
                    <button
                      type="button"
                      onClick={() => setActiveSection("leads")}
                      className="text-primary hover:text-primary text-sm transition-colors"
                    >
                      View all
                    </button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {leads.slice(0, 3).map((lead) => (
                        <div
                          key={lead.id}
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div>
                            <div className="text-foreground font-medium">{lead.name ?? "Unknown"}</div>
                            <div className="text-muted-foreground text-sm">{lead.email}</div>
                          </div>
                          <Badge
                            className={lead.status === "new" ? "bg-primary" : "bg-secondary"}
                          >
                            {lead.status || "new"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}

          {/* LEADS */}
          {activeSection === "leads" ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-display text-3xl tracking-tight text-foreground">Leads</h1>
                  <p className="text-muted-foreground mt-1">All quote requests from your visualizer</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-primary text-primary-foreground">
                    {leads.filter(l => l.status === "new").length} new
                  </Badge>
                  <Badge className="bg-secondary text-foreground/80">
                    {leads.length} total
                  </Badge>
                </div>
              </div>

              {leads.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="p-12 text-center">
                    <Users className="w-12 h-12 text-muted-foreground/70 mx-auto mb-4" />
                    <h3 className="text-foreground font-semibold text-lg mb-2">No leads yet</h3>
                    <p className="text-muted-foreground">Share your visualizer URL to start capturing leads from customers.</p>
                    <Button className="mt-6 bg-primary hover:bg-primary/90" onClick={copyUrl}>
                      <Copy className="w-4 h-4 mr-2" />Copy Visualizer URL
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {leads.map((lead) => (
                    <Card
                      key={lead.id}
                      className={`bg-card border-border transition-colors ${
                        lead.status === "new" ? "border-l-4 border-l-blue-500" : "border-l-4 border-l-gray-700"
                      }`}
                    >
                      <CardContent className="p-5">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          {/* Customer Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-foreground font-semibold text-sm shrink-0">
                                {lead.name ? lead.name.charAt(0).toUpperCase() : "?"}
                              </div>
                              <div>
                                <div className="text-foreground font-semibold">{lead.name || "Unknown"}</div>
                                <div className="text-muted-foreground text-xs">
                                  {new Date(lead.createdAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              </div>
                              <Badge
                                className={`ml-auto sm:ml-2 text-xs ${
                                  lead.status === "new" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground/80"
                                }`}
                              >
                                {lead.status === "new" ? "New" : "Contacted"}
                              </Badge>
                            </div>

                            {/* Contact Details */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                              {lead.phone ? (
                                <a
                                  href={`tel:${lead.phone}`}
                                  className="flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground transition-colors group"
                                >
                                  <Phone className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                                  {lead.phone}
                                </a>
                              ) : null}
                              {lead.email ? (
                                <a
                                  href={`mailto:${lead.email}`}
                                  className="flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground transition-colors group"
                                >
                                  <Mail className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                                  {lead.email}
                                </a>
                              ) : null}
                              {lead.zipCode ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span className="text-muted-foreground/70 text-xs">ZIP</span>
                                  {lead.zipCode}
                                </div>
                              ) : null}
                            </div>

                            {/* Door Interest */}
                            {(lead.styleName || lead.colorName || lead.manufacturerName || lead.windowOption) ? (
                              <div className="bg-muted/50 rounded-lg p-3">
                                <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide mb-2">
                                  Interested In
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {lead.manufacturerName ? (
                                    <span className="text-xs bg-secondary text-foreground/80 px-2 py-1 rounded">
                                      {lead.manufacturerName}
                                    </span>
                                  ) : null}
                                  {lead.styleName ? (
                                    <span className="text-xs bg-secondary text-foreground/80 px-2 py-1 rounded">
                                      {lead.styleName}
                                    </span>
                                  ) : null}
                                  {lead.colorName ? (
                                    <span className="text-xs bg-secondary text-foreground/80 px-2 py-1 rounded">
                                      {lead.colorName}
                                    </span>
                                  ) : null}
                                  {lead.windowOption ? (
                                    <span className="text-xs bg-secondary text-foreground/80 px-2 py-1 rounded">
                                      {lead.windowOption}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}

                            {lead.notes ? (
                              <p className="text-muted-foreground text-sm mt-2 italic">"{lead.notes}"</p>
                            ) : null}

                            {(lead.beforeImageBase64 || lead.afterImageBase64) ? (
                              <div className="mt-3 flex gap-2">
                                {lead.beforeImageBase64 ? (
                                  <div className="flex-1">
                                    <div className="text-muted-foreground/70 text-xs mb-1">Before</div>
                                    <img
                                      src={`data:image/jpeg;base64,${lead.beforeImageBase64}`}
                                      alt="Before"
                                      className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity border border-border"
                                      onClick={() =>
                                        setLightboxImg(`data:image/jpeg;base64,${lead.beforeImageBase64}`)
                                      }
                                    />
                                  </div>
                                ) : null}
                                {lead.afterImageBase64 ? (
                                  <div className="flex-1">
                                    <div className="text-muted-foreground/70 text-xs mb-1">After (AI)</div>
                                    <img
                                      src={`data:image/png;base64,${lead.afterImageBase64}`}
                                      alt="After"
                                      className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity border border-border"
                                      onClick={() =>
                                        setLightboxImg(`data:image/png;base64,${lead.afterImageBase64}`)
                                      }
                                    />
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          {/* Actions */}
                          <div className="flex sm:flex-col gap-2 shrink-0">
                            {lead.phone ? (
                              <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                                <a href={`tel:${lead.phone}`}>
                                  <Phone className="w-3.5 h-3.5 mr-1.5" />Call
                                </a>
                              </Button>
                            ) : null}
                            {lead.email ? (
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="border-border text-foreground/80 hover:bg-muted hover:text-foreground"
                              >
                                <a href={`mailto:${lead.email}`}>
                                  <Mail className="w-3.5 h-3.5 mr-1.5" />Email
                                </a>
                              </Button>
                            ) : null}
                            {lead.status === "new" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                                onClick={() => markContacted(lead.id)}
                                disabled={updatingLeadId === lead.id}
                              >
                                {updatingLeadId === lead.id ? (
                                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                                )}
                                Mark Contacted
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* CUSTOMIZE */}
          {activeSection === "customize" ? (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-3xl tracking-tight text-foreground">Customize</h1>
                <p className="text-muted-foreground mt-1">
                  Customize how your visualizer appears to customers
                </p>
              </div>

              {/* Vanity slug / visualizer link — grandfathered clients only.
                  New clients embed the visualizer instead of sharing a URL. */}
              {showIndividualUrl ? (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-primary" />
                    Your Visualizer Link
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Choose a clean, memorable web address for your visualizer.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={saveSlug} className="space-y-3 max-w-xl">
                    <div className="space-y-2">
                      <Label className="text-foreground/80">Custom URL</Label>
                      <div className="flex items-stretch rounded-lg border border-border bg-muted overflow-hidden focus-within:ring-1 focus-within:ring-primary">
                        <span className="px-3 flex items-center text-muted-foreground text-sm border-r border-border whitespace-nowrap">
                          {window.location.host}/v/
                        </span>
                        <Input
                          value={vanitySlug}
                          onChange={(e) =>
                            setVanitySlug(
                              e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                            )
                          }
                          placeholder="your-company"
                          className="border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
                        />
                      </div>
                      <div className="min-h-[18px] text-xs">
                        {slugStatus.checking ? (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Checking availability…
                          </span>
                        ) : slugStatus.available === true ? (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Available
                          </span>
                        ) : slugStatus.available === false ? (
                          <span className="text-destructive flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> {slugStatus.reason}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Lowercase letters, numbers and dashes. Leave blank to use your default
                            link.
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="submit"
                        disabled={savingSlug || slugStatus.checking || slugStatus.available === false}
                        className="bg-primary hover:bg-primary/90"
                      >
                        {savingSlug ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Save Link
                      </Button>
                      <a
                        href={visualizerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1 break-all"
                      >
                        {visualizerUrl.replace(/^https?:\/\//, "")}
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    </div>
                  </form>
                </CardContent>
              </Card>
              ) : null}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground">Brand Assets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={saveBranding} className="space-y-5">
                      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                        <div>
                          <p className="text-foreground font-semibold flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-primary" /> Auto-fill from your website
                          </p>
                          <p className="text-muted-foreground text-sm">
                            Enter your website and we'll pull your logo, colors, and photos automatically.
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            value={websiteUrl}
                            onChange={(e) => setWebsiteUrl(e.target.value)}
                            placeholder="yourbusiness.com"
                            className="bg-muted border-border text-foreground placeholder:text-muted-foreground flex-1"
                          />
                          <Button
                            type="button"
                            onClick={scrapeFromWebsite}
                            disabled={scraping}
                            className="bg-primary hover:bg-primary/90 shrink-0"
                          >
                            {scraping ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                            {scraping ? "Scanning…" : "Auto-fill"}
                          </Button>
                        </div>
                      </div>

                      {/* Live brand preview — reflects the fields below in real time */}
                      <div className="space-y-2">
                        <Label className="text-foreground/80">Live preview</Label>
                        <div className="overflow-hidden rounded-xl border border-border">
                          <div
                            className="relative flex items-center gap-3 px-4 py-3"
                            style={{
                              backgroundColor: primaryColor,
                              backgroundImage: heroImageUrl
                                ? `linear-gradient(to right, ${primaryColor}, ${primaryColor}cc), url(${
                                    heroImageUrl.startsWith("/uploads/") ? `${BACKEND_URL}${heroImageUrl}` : heroImageUrl
                                  })`
                                : undefined,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }}
                          >
                            {logoUrl ? (
                              <img
                                src={logoUrl.startsWith("/uploads/") ? `${BACKEND_URL}${logoUrl}` : logoUrl}
                                alt="Logo"
                                className="h-8 w-8 rounded bg-white/90 object-contain p-0.5"
                                onError={(e) => {
                                  ;(e.target as HTMLImageElement).style.display = "none"
                                }}
                              />
                            ) : null}
                            <span className="font-semibold text-white drop-shadow">
                              {businessName || "Your Business"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 bg-card px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-foreground text-sm font-medium truncate">
                                See your new garage door before you buy
                              </p>
                              <p className="text-muted-foreground text-xs">This is how your visualizer header will look.</p>
                            </div>
                            <span
                              className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow"
                              style={{ backgroundColor: primaryColor }}
                            >
                              Design a New Door
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-foreground/80">Business Name</Label>
                        <Input
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          placeholder="Your Business Name"
                          className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-foreground/80">Logo</Label>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 cursor-pointer bg-muted hover:bg-secondary border border-border text-foreground/80 hover:text-foreground rounded-lg px-4 py-2 text-sm transition-colors shrink-0">
                            {uploadingLogo ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            {uploadingLogo ? "Uploading..." : "Upload Image"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                              disabled={uploadingLogo}
                            />
                          </label>
                          <span className="text-muted-foreground/70 text-sm">or</span>
                          <Input
                            value={logoUrl}
                            onChange={(e) => setLogoUrl(e.target.value)}
                            placeholder="https://yoursite.com/logo.png"
                            className="bg-muted border-border text-foreground placeholder:text-muted-foreground flex-1"
                          />
                        </div>
                        {logoUrl ? (
                          <div className="p-3 bg-muted rounded-lg flex items-center gap-3">
                            <img
                              src={logoUrl.startsWith("/uploads/") ? `${BACKEND_URL}${logoUrl}` : logoUrl}
                              alt="Logo"
                              className="h-10 object-contain"
                              onError={(e) => {
                                ;(e.target as HTMLImageElement).style.display = "none"
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setLogoUrl("")}
                              className="text-muted-foreground hover:text-destructive text-xs ml-auto"
                            >
                              Remove
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-foreground/80">Hero Background Image</Label>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 cursor-pointer bg-muted hover:bg-secondary border border-border text-foreground/80 hover:text-foreground rounded-lg px-4 py-2 text-sm transition-colors shrink-0">
                            {uploadingHero ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            {uploadingHero ? "Enhancing with AI..." : "Upload Image"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                handleHeroUpload(e.target.files?.[0])
                                // Reset so re-selecting the same file (e.g.
                                // after Cancel) still fires onChange.
                                e.target.value = ""
                              }}
                              disabled={uploadingHero}
                            />
                          </label>
                          <span className="text-muted-foreground/70 text-sm">or</span>
                          <Input
                            value={heroImageUrl}
                            onChange={(e) => setHeroImageUrl(e.target.value)}
                            placeholder="https://yoursite.com/hero.jpg"
                            className="bg-muted border-border text-foreground placeholder:text-muted-foreground flex-1"
                          />
                        </div>
                        {heroImageUrl ? (
                          <div className="p-3 bg-muted rounded-lg flex items-center gap-3">
                            <img
                              src={
                                heroImageUrl.startsWith("/uploads/")
                                  ? `${BACKEND_URL}${heroImageUrl}`
                                  : heroImageUrl
                              }
                              alt="Hero"
                              className="h-16 w-full object-cover rounded"
                              onError={(e) => {
                                ;(e.target as HTMLImageElement).style.display = "none"
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setHeroImageUrl("")}
                              className="text-muted-foreground hover:text-destructive text-xs ml-auto shrink-0"
                            >
                              Remove
                            </button>
                          </div>
                        ) : null}
                        <p className="text-muted-foreground text-xs">
                          Shown as the banner background on your visualizer page.
                          Crop your photo to control how it's framed on your page.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-foreground/80">Primary Color</Label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="w-12 h-10 rounded cursor-pointer border border-border bg-transparent"
                          />
                          <Input
                            value={primaryColor}
                            onChange={(e) => setPrimaryColor(e.target.value)}
                            className="bg-muted border-border text-foreground font-mono"
                          />
                        </div>
                        <div
                          className="h-8 rounded-lg transition-colors"
                          style={{ backgroundColor: primaryColor }}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-foreground/80">Contact Phone</Label>
                        <Input
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="(555) 123-4567"
                          className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-foreground/80">Contact Email</Label>
                        <Input
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="info@yourcompany.com"
                          className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                        />
                      </div>

                      <Button type="submit" disabled={saving} className="w-full bg-primary hover:bg-primary/90">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Save Changes
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Live Preview */}
                <div className="space-y-4">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">Live Preview</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        How customers will see your visualizer header
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-xl overflow-hidden border border-border">
                        <div
                          className="p-4 flex items-center justify-between"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <div className="flex items-center gap-3">
                            {logoUrl ? (
                              <img
                                src={
                                  logoUrl.startsWith("/uploads/")
                                    ? `${BACKEND_URL}${logoUrl}`
                                    : logoUrl
                                }
                                alt="Logo"
                                className="h-8 object-contain"
                                onError={(e) => {
                                  ;(e.target as HTMLImageElement).style.display = "none"
                                }}
                              />
                            ) : (
                              <span className="text-white font-bold text-lg">
                                {businessName || company?.businessName}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-white/80 text-sm">
                            {contactPhone ? (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {contactPhone}
                              </span>
                            ) : null}
                            {contactEmail ? (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {contactEmail}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="bg-muted p-6 text-center">
                          <div className="text-foreground/80 text-sm">Visualizer canvas area</div>
                          <div
                            className="mt-4 rounded-lg p-3 text-white text-sm font-medium"
                            style={{ backgroundColor: primaryColor }}
                          >
                            Request a Quote
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : null}

          {/* REPAIR PRICING */}
          {activeSection === "repair" ? (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-3xl tracking-tight text-foreground">Repair Pricing</h1>
                <p className="text-muted-foreground mt-1">
                  Set your prices for the Repair Estimator. Base prices assume a baseline door
                  (1-Car, standard 7&nbsp;ft, hollow). Multipliers automatically scale the price up for
                  bigger, taller and heavier doors.
                </p>
              </div>

              <Card className="bg-card border-border">
                <CardContent className="flex items-center justify-between gap-4 py-5">
                  <div className="min-w-0">
                    <p className="text-foreground font-semibold">Repair Estimator</p>
                    <p className="text-muted-foreground text-sm">
                      {repairEnabled
                        ? "Customers can request a repair estimate on your visualizer."
                        : "Hidden from customers — only the door designer is shown."}
                    </p>
                  </div>
                  <Switch
                    checked={repairEnabled}
                    disabled={togglingRepair}
                    onCheckedChange={toggleRepairEnabled}
                    aria-label="Toggle Repair Estimator"
                  />
                </CardContent>
              </Card>

              {repairEnabled ? (
              <form onSubmit={saveRepairSettings} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  {/* Base prices grouped by part */}
                  {REPAIR_PARTS.map((part) => {
                    const options = REPAIR_CATALOG.filter((r) => r.partId === part.id)
                    if (options.length === 0) return null
                    return (
                      <Card key={part.id} className="bg-card border-border">
                        <CardHeader>
                          <CardTitle className="text-foreground text-base">{part.name}</CardTitle>
                          <CardDescription className="text-muted-foreground">{part.blurb}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                          {options.map((opt) => (
                            <div key={opt.key} className="space-y-2">
                              <Label className="text-foreground/80">{opt.label}</Label>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-sm">$</span>
                                <Input
                                  type="number"
                                  min={0}
                                  step={5}
                                  value={basePriceFor(opt.key, opt.defaultBasePrice)}
                                  onChange={(e) =>
                                    setRepairPrices((prev) => ({
                                      ...prev,
                                      [opt.key]: Number(e.target.value),
                                    }))
                                  }
                                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                                />
                              </div>
                              <p className="text-muted-foreground text-xs">{opt.description}</p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )
                  })}

                  <Button
                    type="submit"
                    disabled={savingRepair}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    {savingRepair ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Repair Pricing
                  </Button>
                </div>

                {/* Right column: multipliers + live preview */}
                <div className="space-y-6">
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground text-base">Door Size Multipliers</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        How much heavier doors add to the base price.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {([
                        {
                          key: "twoCarMultiplier" as const,
                          label: "2-Car Door",
                          help: "A 2-Car door costs this many times the 1-Car price.",
                        },
                        {
                          key: "tallMultiplier" as const,
                          label: "Extra-Tall Door",
                          help: "Extra-tall (8 ft+) doors cost this many times the standard price.",
                        },
                        {
                          key: "vinylMultiplier" as const,
                          label: "Vinyl-Back Door",
                          help: "Vinyl-backed doors cost this many times a hollow door.",
                        },
                        {
                          key: "steelMultiplier" as const,
                          label: "Steel-Back Door",
                          help: "Solid steel doors cost this many times a hollow door.",
                        },
                      ]).map((m) => (
                        <div key={m.key} className="space-y-2">
                          <Label className="text-foreground/80">{m.label}</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              max={5}
                              step={0.05}
                              value={repairMultipliers[m.key]}
                              onChange={(e) =>
                                setRepairMultipliers((prev) => ({
                                  ...prev,
                                  [m.key]: Number(e.target.value),
                                }))
                              }
                              className="bg-muted border-border text-foreground"
                            />
                            <span className="text-muted-foreground text-sm">×</span>
                          </div>
                          <p className="text-muted-foreground text-xs">{m.help}</p>
                        </div>
                      ))}

                      <div className="space-y-2">
                        <Label className="text-foreground/80">Service Call Fee</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-sm">$</span>
                          <Input
                            type="number"
                            min={0}
                            step={5}
                            value={repairMultipliers.serviceCallFee}
                            onChange={(e) =>
                              setRepairMultipliers((prev) => ({
                                ...prev,
                                serviceCallFee: Number(e.target.value),
                              }))
                            }
                            className="bg-muted border-border text-foreground"
                          />
                        </div>
                        <p className="text-muted-foreground text-xs">
                          A flat trip charge added to every estimate. Set to 0 for none.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Live example preview */}
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground text-base">Live Example Prices</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Exactly what customers will see for a few common doors, using your numbers above.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="divide-y divide-border">
                        {([
                          {
                            label: "Hollow 1-Car — Replace 1 Spring",
                            repairKey: "springs_replace",
                            config: { width: "1car", height: "standard", insulation: "hollow", springs: "torsion" } as DoorConfig,
                          },
                          {
                            label: "Steel-Back 2-Car — Replace 1 Spring",
                            repairKey: "springs_replace",
                            config: { width: "2car", height: "standard", insulation: "steel", springs: "torsion" } as DoorConfig,
                          },
                          {
                            label: "Steel-Back 2-Car — Replace Both Springs",
                            repairKey: "springs_replace_pair",
                            config: { width: "2car", height: "standard", insulation: "steel", springs: "torsion" } as DoorConfig,
                          },
                          {
                            label: "Vinyl 2-Car — Replace a Panel",
                            repairKey: "panel_replace",
                            config: { width: "2car", height: "standard", insulation: "vinyl", springs: "torsion" } as DoorConfig,
                          },
                        ]).map((row) => {
                          const entry = REPAIR_CATALOG.find((r) => r.key === row.repairKey)
                          const price = entry
                            ? computeRepairPrice(
                                basePriceFor(entry.key, entry.defaultBasePrice),
                                entry.scalesWith,
                                row.config,
                                repairMultipliers
                              )
                            : 0
                          return (
                            <div key={row.label} className="flex items-center justify-between py-2.5">
                              <span className="text-sm text-foreground/80 pr-3">{row.label}</span>
                              <span className="text-sm font-semibold text-foreground shrink-0">
                                ${price.toLocaleString()}
                              </span>
                            </div>
                          )
                        })}
                        {repairMultipliers.serviceCallFee > 0 ? (
                          <div className="flex items-center justify-between py-2.5">
                            <span className="text-sm text-muted-foreground pr-3">+ Service call fee (every estimate)</span>
                            <span className="text-sm font-medium text-foreground/80 shrink-0">
                              ${repairMultipliers.serviceCallFee.toLocaleString()}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </form>
              ) : null}
            </div>
          ) : null}

          {/* ACCOUNT */}
          {activeSection === "account" ? (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-3xl tracking-tight text-foreground">Account</h1>
                <p className="text-muted-foreground mt-1">Manage your subscription and account settings</p>
              </div>

              {/* Subscription section */}
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">Subscription</h2>

                {isActive ? (
                  <div className="space-y-4">
                    <Card className="bg-card border-border">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-5">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <div className="text-foreground font-semibold">Active Subscription</div>
                            <div className="text-muted-foreground text-sm">
                              Your visualizer is live and capturing leads
                            </div>
                          </div>
                          <Badge className="ml-auto bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                            Active
                          </Badge>
                        </div>

                        <div className="bg-muted rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            {company?.tierType === "growth" ? (
                              <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
                                <Zap className="w-6 h-6 text-amber-600" />
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Star className="w-6 h-6 text-primary" />
                              </div>
                            )}
                            <div>
                              <div className="text-foreground font-bold text-lg">{tierLabel} Plan</div>
                              <div className="text-muted-foreground text-sm">{tierAmount}/month • Billed monthly</div>
                            </div>
                          </div>
                          {isFree ? (
                            <Badge className="bg-violet-500/15 text-violet-600 border border-violet-500/30 gap-1">
                              <CheckCircle className="w-3 h-3" /> Complimentary access
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-border text-foreground/80 hover:bg-secondary"
                                onClick={handleCancelSubscription}
                                disabled={canceling}
                              >
                                {canceling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Cancel Subscription
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-border text-foreground/80 hover:bg-secondary"
                                onClick={() =>
                                  handleSubscribe(company?.tierType === "growth" ? "starter" : "growth")
                                }
                              >
                                {company?.tierType === "growth" ? "Switch to Starter" : "Switch to Growth"}
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {company?.tierType === "starter" ? (
                            <>
                              <div className="flex items-center gap-2 text-foreground/80 text-sm">
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                Branded visualizer link
                              </div>
                              <div className="flex items-center gap-2 text-foreground/80 text-sm">
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                Email lead delivery
                              </div>
                              <div className="flex items-center gap-2 text-foreground/80 text-sm">
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                AI brand matching
                              </div>
                              <div className="flex items-center gap-2 text-foreground/80 text-sm">
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                Powered by DoorViz Pro badge
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 text-foreground/80 text-sm">
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                Fully white-labeled
                              </div>
                              <div className="flex items-center gap-2 text-foreground/80 text-sm">
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                Custom domain support
                              </div>
                              <div className="flex items-center gap-2 text-foreground/80 text-sm">
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                Lead management dashboard
                              </div>
                              <div className="flex items-center gap-2 text-foreground/80 text-sm">
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                Pricing multipliers
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {company?.tierType === "starter" ? (
                      <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/30">
                        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div>
                            <div className="text-amber-700 font-semibold mb-1 flex items-center gap-2">
                              <Zap className="w-4 h-4" />
                              Upgrade to Growth
                            </div>
                            <p className="text-amber-700/70 text-sm">
                              Remove the badge, add custom domain, and unlock pricing multipliers.
                            </p>
                          </div>
                          <Button
                            onClick={() => handleSubscribe("growth")}
                            disabled={subscribing === "growth"}
                            className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold shrink-0"
                          >
                            {subscribing === "growth" ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            Upgrade — $99/mo
                          </Button>
                        </CardContent>
                      </Card>
                    ) : null}
                  </div>
                ) : (
                  /* Plan selection for unpaid users */
                  <div className="space-y-6">
                    <Card className="bg-card border-border">
                      <CardContent className="p-8 text-center">
                        <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CreditCard className="w-7 h-7 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-2">
                          Activate Your Subscription
                        </h2>
                        <p className="text-muted-foreground max-w-md mx-auto">
                          Choose your plan to publish your visualizer and start capturing leads
                        </p>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Starter Plan */}
                      <Card className="bg-card border-border relative overflow-hidden">
                        <CardHeader className="pb-4">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                              <Star className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-foreground">Starter Plan</CardTitle>
                              <div className="text-3xl font-bold text-foreground mt-1">
                                $49<span className="text-lg text-muted-foreground font-normal">/month</span>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <ul className="space-y-2.5">
                            {[
                              "Branded visualizer link",
                              "Email lead delivery",
                              "AI brand matching",
                              "Powered by DoorViz Pro badge",
                            ].map((feature) => (
                              <li key={feature} className="flex items-center gap-2 text-foreground/80 text-sm">
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                          <Button
                            onClick={() => handleSubscribe("starter")}
                            disabled={subscribing !== null}
                            variant="outline"
                            className="w-full border-border text-foreground hover:bg-muted mt-2"
                          >
                            {subscribing === "starter" ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            Subscribe — $49/mo
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Growth Plan */}
                      <Card className="bg-card border-amber-500/40 relative overflow-hidden shadow-yellow-900/20 shadow-lg">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
                        <div className="absolute top-4 right-4">
                          <Badge className="bg-amber-500 text-amber-950 font-semibold text-xs">
                            Most Popular
                          </Badge>
                        </div>
                        <CardHeader className="pb-4">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                              <Zap className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                              <CardTitle className="text-foreground">Growth Plan</CardTitle>
                              <div className="text-3xl font-bold text-foreground mt-1">
                                $99<span className="text-lg text-muted-foreground font-normal">/month</span>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <ul className="space-y-2.5">
                            {[
                              "Fully white-labeled (no badge)",
                              "Custom domain support",
                              "Lead management dashboard",
                              "Pricing multipliers",
                            ].map((feature) => (
                              <li key={feature} className="flex items-center gap-2 text-foreground/80 text-sm">
                                <CheckCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                          <Button
                            onClick={() => handleSubscribe("growth")}
                            disabled={subscribing !== null}
                            className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold mt-2"
                          >
                            {subscribing === "growth" ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            Subscribe — $99/mo
                          </Button>
                        </CardContent>
                      </Card>
                    </div>

                    <p className="text-center text-muted-foreground text-sm">
                      Your visualizer is ready. Complete payment to publish it.
                    </p>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Email Notifications */}
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Email Notifications</h2>
                <p className="text-muted-foreground text-sm mb-4">
                  Get notified when a customer submits a quote request
                </p>

                <div className="space-y-4 max-w-xl">
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-5">
                      <h3 className="text-primary font-semibold mb-2">How email notifications work</h3>
                      <ul className="text-foreground/70 text-sm space-y-1.5">
                        <li>• Leads are always saved to your Leads dashboard</li>
                        <li>• To also receive email alerts, connect your Resend account below</li>
                        <li>
                          • Emails are sent to your{" "}
                          <strong className="text-foreground/80">Lead Notification Email</strong> below
                          {" "}(or your Contact Email if that's left blank)
                        </li>
                        <li>
                          • Get a free Resend API key at{" "}
                          <span className="font-mono text-primary">resend.com</span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-foreground">Resend Configuration</CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Emails are sent to your contact email when a customer requests a quote
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={saveEmailSettings} className="space-y-5">
                        <div className="space-y-2">
                          <Label className="text-foreground/80">Lead Notification Email</Label>
                          <Input
                            type="email"
                            value={notificationEmail}
                            onChange={(e) => setNotificationEmail(e.target.value)}
                            placeholder="owner@yourbusiness.com"
                            className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                          />
                          <p className="text-muted-foreground text-xs">
                            Leave blank to use your Contact Email. Set an address here to send lead alerts somewhere else.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-foreground/80">Resend API Key</Label>
                          <div className="relative">
                            <Input
                              type={showApiKey ? "text" : "password"}
                              value={resendApiKey}
                              onChange={(e) => setResendApiKey(e.target.value)}
                              placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxx"
                              className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10 font-mono text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80 transition-colors"
                            >
                              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            Found in your Resend dashboard under API Keys
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-foreground/80">From Email Address</Label>
                          <Input
                            type="email"
                            value={resendFromEmail}
                            onChange={(e) => setResendFromEmail(e.target.value)}
                            placeholder="noreply@yourdomain.com"
                            className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                          />
                          <p className="text-muted-foreground text-xs">
                            Must be a verified domain in your Resend account
                          </p>
                        </div>

                        <Button
                          type="submit"
                          disabled={savingEmail}
                          className="w-full bg-primary hover:bg-primary/90"
                        >
                          {savingEmail ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : emailSaved ? (
                            <CheckCircle className="w-4 h-4 mr-2 text-emerald-600" />
                          ) : null}
                          {emailSaved ? "Saved!" : "Save Email Settings"}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Advanced — Growth only */}
              <div className="border-t border-border" />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-semibold text-foreground">Advanced</h2>
                  {company?.tierType !== "growth" ? (
                    <Badge className="bg-amber-500/15 text-amber-600 border border-amber-500/30 text-xs">
                      Growth plan required
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/15 text-amber-600 border border-amber-500/30 text-xs">
                      Growth
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  Custom domain controls for Growth plan subscribers
                </p>

                {company?.tierType === "growth" ? (
                  <Card className="bg-card border-amber-500/30 max-w-xl">
                    <CardHeader>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Zap className="w-5 h-5 text-amber-600" />
                        Growth Plan Features
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        Advanced settings available on your Growth plan
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={saveGrowthSettings} className="space-y-5">
                        <div className="space-y-2">
                          <Label className="text-foreground/80 flex items-center gap-2">
                            <Globe className="w-4 h-4 text-muted-foreground" />
                            Custom Domain
                          </Label>
                          <Input
                            value={customDomain}
                            onChange={(e) => setCustomDomain(e.target.value)}
                            placeholder="visualizer.yourcompany.com"
                            className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                          />
                          <p className="text-muted-foreground text-xs">
                            Point a CNAME for this domain at our servers, then save it here — your
                            visualizer will load at your own domain.
                          </p>
                        </div>

                        <Button
                          type="submit"
                          disabled={savingGrowth}
                          className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold"
                        >
                          {savingGrowth ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Save Growth Settings
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-card/60 border-border max-w-xl">
                    <CardContent className="p-6 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        <Lock className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="text-foreground font-semibold mb-1">Custom Domain &amp; Pricing Controls</div>
                        <p className="text-muted-foreground text-sm mb-3">
                          Upgrade to Growth to remove the DoorViz Pro badge, add a custom domain, and set pricing multipliers.
                        </p>
                        {isActive ? (
                          <Button
                            onClick={() => handleSubscribe("growth")}
                            disabled={subscribing === "growth"}
                            className="bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold"
                          >
                            {subscribing === "growth" ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            Upgrade to Growth — $99/mo
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImg ? (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImg(null)}
        >
          <img
            src={lightboxImg}
            alt="Lead image"
            className="max-w-full max-h-full rounded-xl object-contain"
          />
          <button
            type="button"
            className="absolute top-4 right-4 text-foreground/70 hover:text-foreground text-2xl"
            onClick={() => setLightboxImg(null)}
          >
            ✕
          </button>
        </div>
      ) : null}

      <CheckoutDialog
        open={checkoutDialogOpen}
        onOpenChange={setCheckoutDialogOpen}
        planName={checkoutTier === "growth" ? "Growth" : "Starter"}
        planPrice={checkoutTier === "growth" ? "$99/month" : "$49/month"}
        onPay={handlePay}
      />

      <HeroCropDialog
        open={heroCropOpen}
        imageSrc={heroCropSrc}
        saving={uploadingHero}
        onConfirm={handleHeroCropConfirm}
        onCancel={handleHeroCropCancel}
      />
    </div>
  )
}
