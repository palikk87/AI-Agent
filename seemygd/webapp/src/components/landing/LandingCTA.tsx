import { ArrowRight, DoorOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function LandingCTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground shadow-2xl sm:px-12 sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-blueprint opacity-40" aria-hidden />
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/3 rounded-full bg-accent/25 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-xl">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-lg">
            <DoorOpen className="h-6 w-6" />
          </span>
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            See it for yourself — it's free.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-base text-primary-foreground/80">
            Try the live visualizer the way your customers will. No sign-up, no card — just upload a
            photo and watch a new door appear.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 bg-accent px-7 text-sm font-bold text-accent-foreground shadow-lg shadow-accent/25 hover:bg-accent/90"
            >
              <Link to="/tool">
                Launch the live tool
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-white/25 bg-white/5 px-7 text-sm font-semibold text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
            >
              <Link to="/signup">Create a business account</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
