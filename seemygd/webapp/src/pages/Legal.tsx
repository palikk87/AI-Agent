import { Link } from "react-router-dom"

/**
 * Public Legal page — Disclaimer + Privacy Policy.
 *
 * Served at /legal and linked from every footer. Written to disclaim
 * liability for the AI-generated visualizations (which are illustrative
 * approximations, not exact representations of any product) and to describe
 * how uploaded photos are handled. Brand-neutral so it works on the marketing
 * site, the /v/:company visualizer, and customer custom domains alike.
 */
export default function Legal() {
  const updated = "June 24, 2026"

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            ← Back
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Disclaimer &amp; Privacy Policy</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last updated {updated}</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
          {/* ---------- DISCLAIMER ---------- */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">1. Visualization Disclaimer</h2>
            <p>
              This tool generates <strong>AI-created visualizations</strong> intended only to give you a{" "}
              <strong>general idea</strong> of how a door style might look. It is <strong>not</strong> a
              literal, accurate, or exact portrayal of your home or of any specific product, material,
              color, finish, dimension, or installation result, and should never be treated as one.
            </p>
            <p>
              Because the images are produced by artificial intelligence, the AI may{" "}
              <strong>“hallucinate,” invent, distort, remove, or alter details</strong> — including parts of
              your photo unrelated to the garage door, such as the house, windows, trim, driveway,
              landscaping, vehicles, people, lighting, shadows, proportions, and background. These changes
              are an inherent limitation of AI image generation, are{" "}
              <strong>unavoidable and cannot be fully prevented or corrected</strong>, and may occur even
              when the rest of the image is meant to stay the same.
            </p>
            <p>
              Actual garage doors, colors, window configurations, hardware, sizing, and the final installed
              appearance may differ materially from what is shown. Colors displayed on your screen also vary
              by device, lighting, and settings. <strong>Do not rely on these renderings</strong> for
              purchase, measurement, structural, design, or contractual decisions. Always confirm
              specifications, pricing, availability, and suitability directly with the manufacturer or your
              contractor before ordering or installing any product.
            </p>
          </section>

          {/* ---------- NO WARRANTY / LIABILITY ---------- */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">2. No Warranty &amp; Limitation of Liability</h2>
            <p>
              This tool and all content are provided <strong>“as is” and “as available,” without warranties
              of any kind</strong>, whether express, implied, or statutory, including but not limited to
              implied warranties of merchantability, fitness for a particular purpose, accuracy, and
              non-infringement. We do not warrant that the tool will be uninterrupted, error-free, secure,
              or that any output will be accurate or reliable.
            </p>
            <p>
              To the fullest extent permitted by law, the operators, owners, affiliates, manufacturers,
              service providers, and contributors associated with this tool <strong>shall not be liable for
              any direct, indirect, incidental, consequential, special, punitive, or exemplary damages</strong>,
              including without limitation lost profits, lost data, property damage, or costs of substitute
              products or services, arising out of or related to your use of (or inability to use) this tool
              or any reliance on its output, even if advised of the possibility of such damages.
            </p>
            <p>
              You use this tool <strong>entirely at your own risk</strong>. You agree to indemnify and hold
              harmless the operators and their affiliates from any claims, losses, liabilities, or expenses
              arising from your use of the tool or your reliance on any visualization it produces.
            </p>
          </section>

          {/* ---------- PRIVACY ---------- */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">3. Privacy Policy</h2>
            <p>
              <strong>Photos you upload</strong> are transmitted to our image-processing provider solely to
              generate your visualization. We do not sell your photos. Uploaded images and generated results
              may be temporarily stored or cached to deliver the service and improve reliability.
            </p>
            <p>
              If you request a quote or submit contact details, that information is shared with the relevant
              business so they can follow up with you. We may collect basic, non-identifying usage data
              (such as device type and general analytics) to operate and improve the tool.
            </p>
            <p>
              We do not knowingly collect information from children. Do not upload photos containing other
              people, license plates, or sensitive information you do not wish to share. By using this tool
              you consent to this processing.
            </p>
          </section>

          {/* ---------- AGREEMENT ---------- */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">4. Acceptance</h2>
            <p>
              By using this tool you acknowledge that you have read, understood, and agreed to this
              Disclaimer and Privacy Policy. If you do not agree, do not use the tool. We may update these
              terms at any time; continued use constitutes acceptance of the updated terms.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
