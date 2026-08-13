import { Link } from "react-router-dom"
import { Home, Sparkles, TrendingUp, ShieldCheck } from "lucide-react"

interface AuthShellProps {
  /** Small eyebrow above the form heading, e.g. "Welcome back" */
  eyebrow: string
  title: string
  subtitle: string
  children: React.ReactNode
  /** Footer row under the form (links etc.) */
  footer?: React.ReactNode
}

/**
 * Premium split-screen auth layout shared by Login and Signup.
 *
 * Left: an editorial brand panel (deep primary gradient, grid texture, soft
 * glow, headline in the Fraunces display face) that only shows on large
 * screens. Right: the form on a warm neutral surface. The whole thing uses
 * semantic brand tokens so it matches the public site and the dashboard.
 */
export function AuthShell({ eyebrow, title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen w-full bg-background lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — desktop only */}
      <div className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between p-12 text-primary-foreground">
        {/* Texture + glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(0 0% 100% / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100% / 0.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 80% 70% at 30% 20%, black 30%, transparent 75%)",
          }}
        />
        <div className="pointer-events-none absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-glow-pulse" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />

        {/* Logo */}
        <Link to="/" className="relative z-10 flex items-center gap-3 w-fit">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
            <Home className="h-5 w-5" />
          </span>
          <div className="leading-none">
            <div className="text-base font-bold tracking-tight">DoorViz Pro</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-primary-foreground/60">
              Visualizer Platform
            </div>
          </div>
        </Link>

        {/* Headline */}
        <div className="relative z-10 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/15">
            <Sparkles className="h-3.5 w-3.5" />
            AI-powered door visualizer
          </div>
          <h2 className="font-display text-4xl leading-[1.1] tracking-tight xl:text-5xl">
            Turn curious browsers into booked jobs.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-primary-foreground/70">
            Let homeowners preview new garage doors on their own house in seconds — fully branded
            to your business — and capture every lead automatically.
          </p>
        </div>

        {/* Proof points */}
        <div className="relative z-10 grid grid-cols-2 gap-4 max-w-md">
          <Stat icon={TrendingUp} label="More qualified leads" value="Higher intent" />
          <Stat icon={ShieldCheck} label="Setup in minutes" value="No code" />
        </div>
      </div>

      {/* Form panel */}
      <div className="flex min-h-screen flex-col items-center justify-center px-5 py-12 lg:min-h-0">
        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-3 duration-500">
          {/* Mobile logo */}
          <Link to="/" className="mb-10 flex items-center justify-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Home className="h-4 w-4" />
            </span>
            <span className="text-lg font-bold tracking-tight">DoorViz Pro</span>
          </Link>

          <div className="mb-8">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {eyebrow}
            </div>
            <h1 className="font-display text-3xl tracking-tight text-foreground">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          </div>

          {children}

          {footer ? <div className="mt-8 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
      <Icon className="h-5 w-5 text-primary-foreground/80" />
      <div className="mt-3 text-sm font-semibold">{value}</div>
      <div className="text-xs text-primary-foreground/60">{label}</div>
    </div>
  )
}
