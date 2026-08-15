import {
  Wrench,
  ToggleRight,
  Code2,
  Palette,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardMockup } from "./mockups/DashboardMockup";

type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
  /** Highlighted feature spans two columns and uses the accent treatment. */
  featured?: boolean;
};

const FEATURES: Feature[] = [
  {
    icon: Palette,
    title: "One dashboard to brand it and run it",
    body: "Set your business name, logo, and brand color, grab your one-line embed code, and flip the repair estimator on or off — all from a single dashboard. Every design and estimate a homeowner creates lands here as a lead.",
    featured: true,
  },
  {
    icon: Wrench,
    title: "Instant repair estimates",
    body: "Homeowners answer a few quick questions and get an on-the-spot repair price — so service jobs come to you pre-qualified.",
  },
  {
    icon: ToggleRight,
    title: "Turn the repair estimator on or off",
    body: "Toggle the repair tool per account from your dashboard. Sell and install only? Switch it off. Offer service too? Keep it on. It's your call.",
  },
  {
    icon: Code2,
    title: "One-snippet embed, any website",
    body: "Drop in a single snippet — a popup button or a full-width iframe — and it works on any site or platform you already use.",
  },
  {
    icon: Palette,
    title: "Fully branded to your business",
    body: "Your logo, your colors, your custom domain or subdomain. The tool feels like a native part of your own website.",
  },
  {
    icon: UserPlus,
    title: "Captures every lead for you",
    body: "Contact details and each design or estimate a homeowner creates land in your dashboard, ready to follow up and close.",
  },
];

function FeatureCard({ icon: Icon, title, body, featured }: Feature) {
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1",
        featured
          ? "border-accent/40 bg-primary text-primary-foreground shadow-xl sm:col-span-2 sm:flex-row sm:items-center sm:gap-8"
          : "border-border bg-card shadow-sm hover:shadow-md"
      )}
    >
      {featured ? (
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/25 blur-3xl"
          aria-hidden
        />
      ) : null}
      <div className={cn("relative", featured ? "sm:max-w-[52%]" : "")}>
        <span
          className={cn(
            "mb-4 flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
            featured
              ? "bg-accent text-accent-foreground"
              : "bg-muted text-primary group-hover:bg-accent/15 group-hover:text-accent"
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <h3
          className={cn(
            "font-display text-lg font-bold tracking-tight",
            featured ? "text-primary-foreground sm:text-2xl" : "text-foreground"
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "mt-2 text-sm leading-relaxed",
            featured ? "text-primary-foreground/75" : "text-muted-foreground"
          )}
        >
          {body}
        </p>
      </div>
      {featured ? (
        <div className="relative mt-6 hidden flex-1 sm:mt-0 sm:block">
          <DashboardMockup compact />
        </div>
      ) : null}
    </div>
  );
}

export function LandingFeatures() {
  return (
    <section id="features" className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Everything included</p>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Two homeowner tools. One lead machine.
        </h2>
        <p className="mt-3 text-base text-muted-foreground">
          SeeMyGD gives garage door companies the tools that turn website visitors into booked jobs —
          without the guesswork.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>
    </section>
  );
}
