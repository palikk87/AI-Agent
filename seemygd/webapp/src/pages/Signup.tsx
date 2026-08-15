import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { signUp } from "@/lib/auth"
import { api } from "@/lib/api"
import { AuthShell } from "@/components/auth/AuthShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  Loader2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react"

type Step = 1 | 2 | 3

const STEP_META: Record<Step, { eyebrow: string; title: string; subtitle: string }> = {
  1: {
    eyebrow: "Step 1 of 3",
    title: "Create your account",
    subtitle: "A few quick steps and your branded visualizer is live.",
  },
  2: {
    eyebrow: "Step 2 of 3",
    title: "Tell us about your business",
    subtitle: "We'll use this to brand your visualizer to your company.",
  },
  3: {
    eyebrow: "Step 3 of 3",
    title: "Confirm your branding",
    subtitle: "We pulled this from your website — adjust anything that looks off.",
  },
}

export default function Signup() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)

  // Step 1 fields
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // Step 2 fields
  const [businessName, setBusinessName] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [scraping, setScraping] = useState(false)

  // Step 3 fields (scraped + editable)
  const [logoUrl, setLogoUrl] = useState("")
  const [heroImageUrl, setHeroImageUrl] = useState("")
  const [primaryColor, setPrimaryColor] = useState("#2563EB")
  const [contactPhone, setContactPhone] = useState("")
  const [contactEmail, setContactEmail] = useState("")

  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await signUp(name, email, password)
      setStep(2)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create account")
    } finally {
      setLoading(false)
    }
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setStep(3)

    if (!websiteUrl) return

    setScraping(true)
    api
      .post<{
        logoUrl: string | null
        primaryColorHex: string | null
        contactPhone: string | null
        contactEmail: string | null
        heroImageUrl: string | null
      }>("/api/onboard/scrape-brand", { websiteUrl })
      .then((scraped) => {
        setLogoUrl(scraped.logoUrl ?? "")
        setPrimaryColor(scraped.primaryColorHex ?? "#2563EB")
        setHeroImageUrl(scraped.heroImageUrl ?? "")
        setContactPhone(scraped.contactPhone ?? "")
        setContactEmail(scraped.contactEmail ?? "")
      })
      .catch(() => {})
      .finally(() => setScraping(false))
  }

  async function handleStep3(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await api.post("/api/onboard/complete", {
        businessName,
        websiteUrl,
        logoUrl: logoUrl || undefined,
        heroImageUrl: heroImageUrl || undefined,
        primaryColorHex: primaryColor,
        contactPhone: contactPhone || undefined,
        contactEmail: contactEmail || undefined,
      })
      // Onboarding activates the free plan on the backend — go straight in.
      navigate("/dashboard")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to complete setup")
    } finally {
      setLoading(false)
    }
  }

  const meta = STEP_META[step]

  return (
    <AuthShell
      eyebrow={meta.eyebrow}
      title={meta.title}
      subtitle={meta.subtitle}
      footer={
        step === 1 ? (
          <>
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </>
        ) : undefined
      }
    >
      {/* Progress bar */}
      <div className="mb-7 flex items-center gap-1.5">
        {([1, 2, 3, 4] as Step[]).map((s) => (
          <div
            key={s}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-500",
              step >= s ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>

      {error ? (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* STEP 1 — Account */}
      {step === 1 ? (
        <form onSubmit={handleStep1} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11"
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@garageco.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          <Button type="submit" className="h-11 w-full text-sm font-semibold" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Continue
            {!loading ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
          </Button>
        </form>
      ) : null}

      {/* STEP 2 — Business */}
      {step === 2 ? (
        <form onSubmit={handleStep2} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              placeholder="Ace Garage Doors"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="h-11"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">
              Website <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="website"
              type="url"
              placeholder="https://yourgarageco.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="flex items-start gap-2.5 rounded-xl border border-primary/15 bg-primary/5 p-3.5 text-sm text-foreground/80">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Add your website and we'll automatically pull in your logo, brand colors, and contact
              info — no manual setup.
            </span>
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 px-4"
              onClick={() => {
                setError("")
                setStep(1)
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button type="submit" className="h-11 flex-1 text-sm font-semibold">
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      ) : null}

      {/* STEP 3 — Branding */}
      {step === 3 ? (
        <form onSubmit={handleStep3} className="space-y-5">
          {scraping ? (
            <div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Fetching brand details from your website…</span>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="logo">Logo URL</Label>
            <Input
              id="logo"
              placeholder="https://yoursite.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="h-11"
            />
            {logoUrl ? (
              <div className="mt-2 flex items-center rounded-lg border border-border bg-card p-2.5">
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="h-8 object-contain"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = "none"
                  }}
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="hero">
              Hero image URL <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="hero"
              placeholder="https://yoursite.com/hero.jpg"
              value={heroImageUrl}
              onChange={(e) => setHeroImageUrl(e.target.value)}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Used as the banner background on your visualizer page.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Primary brand color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-11 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                aria-label="Brand color picker"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#2563EB"
                className="h-11 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Contact phone</Label>
              <Input
                id="phone"
                placeholder="(555) 123-4567"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cemail">Contact email</Label>
              <Input
                id="cemail"
                type="email"
                placeholder="info@garageco.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-11 px-4"
              onClick={() => {
                setError("")
                setStep(2)
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button type="submit" className="h-11 flex-1 text-sm font-semibold" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up…
                </>
              ) : (
                <>
                  Continue to plans
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      ) : null}
    </AuthShell>
  )
}
