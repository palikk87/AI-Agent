import { ToolMockup } from "./mockups/ToolMockup";
import { DashboardMockup } from "./mockups/DashboardMockup";

/**
 * "A look inside" — shows the two product surfaces side by side (stacked on
 * mobile): the customer-facing tool and the owner dashboard with branding,
 * customization, and the repair on/off toggle. Every visual is CSS/SVG-drawn;
 * there are no external images anywhere on this page.
 */
export function LandingShowcase() {
  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.15]" aria-hidden />
      <div
        className="pointer-events-none absolute -left-32 top-1/3 h-80 w-80 rounded-full bg-accent/15 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">A look inside</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            See both sides of the product.
          </h2>
          <p className="mt-3 text-base text-primary-foreground/75">
            The polished tool your customers use, and the dashboard where you brand it, capture
            leads, and flip the repair estimator on or off.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <ToolMockup />
            <div className="mt-4">
              <h3 className="font-display text-lg font-bold tracking-tight">The tool your customers use</h3>
              <p className="mt-1 text-sm text-primary-foreground/70">
                Upload a photo, pick a style and color, and see a photorealistic new door — or get an
                instant repair estimate.
              </p>
            </div>
          </div>

          <div>
            <DashboardMockup />
            <div className="mt-4">
              <h3 className="font-display text-lg font-bold tracking-tight">Your dashboard &amp; customization</h3>
              <p className="mt-1 text-sm text-primary-foreground/70">
                Set your business name, logo, and brand color, grab your one-line embed code, and toggle
                the repair estimator on or off — leads land here automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
