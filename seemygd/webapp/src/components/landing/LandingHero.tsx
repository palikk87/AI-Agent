import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ToolMockup } from "./mockups/ToolMockup";

/** Staggered fade-up on load using CSS animation + inline delay. */
function Reveal({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-700", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground">
      {/* Atmosphere */}
      <div className="pointer-events-none absolute inset-0 bg-blueprint opacity-40" aria-hidden />
      <div
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/25 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-accent/10 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <div>
          <Reveal delay={0}>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              AI visualizer for garage door companies
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
              See My Garage Door.
              <span className="mt-2 block text-accent">Sell more of them.</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-primary-foreground/80 sm:text-lg">
              Embed one tool on your website and let homeowners see photorealistic new doors on their
              own home — and get instant repair estimates. Every session is a warm, showroom-quality
              lead delivered straight to you.
            </p>
          </Reveal>

          <Reveal delay={240} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="h-12 bg-accent px-6 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/25 hover:bg-accent/90"
            >
              <Link to="/tool">
                Try the live tool — free
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-white/25 bg-white/5 px-6 text-sm font-semibold text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            >
              <Link to="/signup">Start for your business</Link>
            </Button>
          </Reveal>

          <Reveal delay={320}>
            <p className="mt-4 text-xs text-primary-foreground/60">
              Free to try · No account needed for homeowners · Live in minutes
            </p>
          </Reveal>
        </div>

        {/* Visual card — image-free product screenshot of the live tool */}
        <div className="relative animate-in fade-in zoom-in-95 fill-mode-both delay-200 duration-700">
          <ToolMockup />
          <div className="absolute -bottom-4 -left-3 hidden rotate-[-4deg] rounded-xl border border-white/15 bg-accent px-3 py-2 text-xs font-bold text-accent-foreground shadow-lg sm:block">
            New lead captured
          </div>
        </div>
      </div>
    </section>
  );
}
