import { Code2, ImageUp, Eye, Inbox, type LucideIcon } from "lucide-react";

type Step = {
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: Code2,
    label: "Step 1",
    title: "Embed it on your site",
    body: "Paste one snippet — a popup button or full-width iframe. Brand it with your logo and colors.",
  },
  {
    icon: ImageUp,
    label: "Step 2",
    title: "Homeowner uploads a photo",
    body: "A visitor drops in a picture of their home — no account, no friction, right on your website.",
  },
  {
    icon: Eye,
    title: "They see doors or get a price",
    label: "Step 3",
    body: "Instant photorealistic door previews on their house, or an instant repair estimate if that's what they need.",
  },
  {
    icon: Inbox,
    label: "Step 4",
    title: "You get the lead",
    body: "Their details and every design or estimate land in your dashboard — ready for you to close.",
  },
];

export function LandingHowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden bg-secondary/60">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">How it works</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            From website visit to booked job.
          </h2>
        </div>

        <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="relative flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-4xl font-bold leading-none text-muted-foreground/25">
                    {i + 1}
                  </span>
                </div>
                <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-accent">
                  {step.label}
                </p>
                <h3 className="mt-1 text-base font-bold text-foreground">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
