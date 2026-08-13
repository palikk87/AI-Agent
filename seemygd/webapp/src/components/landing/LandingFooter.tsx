import { DoorOpen } from "lucide-react";
import { Link } from "react-router-dom";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <DoorOpen className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <div className="font-display text-sm font-bold text-foreground">SeeMyGD</div>
              <div className="text-xs text-muted-foreground">seemygd.com · See My Garage Door.</div>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <Link to="/tool" className="transition-colors hover:text-foreground">
              Live tool
            </Link>
            <Link to="/login" className="transition-colors hover:text-foreground">
              Sign In
            </Link>
            <Link to="/signup" className="transition-colors hover:text-foreground">
              Sign Up
            </Link>
            <Link to="/legal" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
          </nav>
        </div>
        <p className="mt-8 border-t border-border pt-5 text-[11px] leading-relaxed text-muted-foreground">
          SeeMyGD is an AI visualizer for garage door businesses. Door previews are AI-generated and
          meant to give a general idea — not a literal portrayal of the final installed product.
          &copy; {new Date().getFullYear()} SeeMyGD.
        </p>
      </div>
    </footer>
  );
}
