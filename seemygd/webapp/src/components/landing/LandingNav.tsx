import { DoorOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <DoorOpen className="h-4.5 w-4.5" />
          </span>
          <div className="leading-none">
            <div className="font-display text-base font-bold tracking-tight text-foreground">SeeMyGD</div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Garage Door Visualizer
            </div>
          </div>
        </Link>

        <nav className="flex items-center gap-1 text-sm text-muted-foreground sm:gap-3">
          <a href="#features" className="hidden px-2 transition-colors hover:text-foreground md:block">
            Features
          </a>
          <a href="#how" className="hidden px-2 transition-colors hover:text-foreground md:block">
            How it works
          </a>
          <div className="ml-1 flex items-center gap-1.5">
            <Button asChild variant="ghost" size="sm" className="h-9 px-3 text-xs font-semibold">
              <Link to="/login">Sign In</Link>
            </Button>
            <Button asChild size="sm" className="h-9 px-3 text-xs font-semibold">
              <Link to="/signup">Sign Up</Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
