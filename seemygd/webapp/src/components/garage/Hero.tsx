import { Home } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/50 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
        <a href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Home className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-bold tracking-tight leading-none">Garage Door Visualizer</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none mt-0.5">AI Preview Tool</div>
          </div>
        </a>
        <nav className="flex items-center gap-3 text-sm text-muted-foreground">
          <a href="#how" className="hidden transition-colors hover:text-foreground sm:block">How it works</a>
          <a href="#brands" className="hidden transition-colors hover:text-foreground sm:block">Brands</a>
          <div className="flex items-center gap-1.5 ml-1">
            <Button asChild variant="ghost" size="sm" className="h-8 px-3 text-xs">
              <Link to="/login">Sign In</Link>
            </Button>
            <Button asChild size="sm" className="h-8 px-3 text-xs">
              <Link to="/signup">Sign Up</Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
