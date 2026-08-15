import { Palette, Code2, Users, Check } from "lucide-react";
import { AppWindow } from "./AppWindow";

/** Brand color swatches; the accent-orange one is selected. */
const BRAND_COLORS = ["#091F3B", "#ff7716", "#0f766e", "#7c3aed", "#b91c1c"];

interface DashboardMockupProps {
  /** Trims detail so it fits the narrow featured-card slot. */
  compact?: boolean;
}

/**
 * Image-free recreation of the business dashboard (src/pages/Dashboard.tsx):
 * a branding/customization card (business name, color swatches, logo
 * placeholder), the embed-code snippet box, and the Repair Estimator ON/OFF
 * toggle. Optional trimmed "Leads" list when not compact.
 */
export function DashboardMockup({ compact = false }: DashboardMockupProps) {
  return (
    <AppWindow url="seemygd.com/dashboard">
      <div className="space-y-2.5 p-3 sm:p-4">
        {/* Branding / customization card */}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
            <Palette className="h-3.5 w-3.5 text-primary" />
            Customize your branding
          </div>

          {/* Business name field */}
          <div className="mb-2.5">
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              Business name
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
              {/* Logo placeholder */}
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                GD
              </span>
              <span className="text-xs font-medium text-slate-700">Premier Garage Doors</span>
            </div>
          </div>

          {/* Primary color picker */}
          <div>
            <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              Primary color
            </div>
            <div className="flex items-center gap-2">
              {BRAND_COLORS.map((c) => {
                const selected = c === "#ff7716";
                return (
                  <span
                    key={c}
                    className={
                      selected
                        ? "flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-slate-800 ring-offset-1"
                        : "h-6 w-6 rounded-full ring-1 ring-slate-300"
                    }
                    style={{ backgroundColor: c }}
                  >
                    {selected ? <Check className="h-3 w-3 text-white" /> : null}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Repair Estimator ON/OFF toggle */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-700">Repair Estimator</div>
            <div className="text-[10px] text-slate-500">Let customers price repairs</div>
          </div>
          {/* Switch — "on" state */}
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">On</span>
            <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-emerald-500">
              <span className="absolute right-0.5 h-4 w-4 rounded-full bg-white shadow" />
            </span>
          </div>
        </div>

        {/* Embed-code snippet box */}
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
            <Code2 className="h-3.5 w-3.5 text-primary" />
            Embed on your website
          </div>
          <div className="overflow-hidden rounded-lg bg-slate-900 p-2.5">
            <code className="block whitespace-pre-wrap break-all font-mono text-[9px] leading-relaxed text-emerald-400 sm:text-[10px]">
              {`<script src="https://seemygd.com/embed.js"\n  data-slug="premier-garage" defer></script>`}
            </code>
          </div>
        </div>

        {/* Leads list — hidden in compact mode to fit the narrow slot */}
        {compact ? null : (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
              <Users className="h-3.5 w-3.5 text-primary" />
              Recent leads
            </div>
            <div className="space-y-1.5">
              {[
                { name: "Jordan M.", tag: "Modern Steel", isNew: true },
                { name: "Casey R.", tag: "Carriage House", isNew: false },
              ].map((lead) => (
                <div
                  key={lead.name}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600">
                      {lead.name.charAt(0)}
                    </span>
                    <span className="text-[11px] font-medium text-slate-700">{lead.name}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">
                      {lead.tag}
                    </span>
                  </div>
                  <span
                    className={
                      lead.isNew
                        ? "rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground"
                        : "rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-medium text-slate-500"
                    }
                  >
                    {lead.isNew ? "New" : "Done"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppWindow>
  );
}
