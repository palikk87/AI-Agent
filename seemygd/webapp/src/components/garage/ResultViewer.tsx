import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download, Mail, Phone, RotateCcw, Share2, Sparkles, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BeforeAfter } from "./BeforeAfter";
import { api } from "@/lib/api";
import type { GarageStyle, SwapResult } from "@/lib/garage-api";

async function blobUrlToBase64(blobUrl: string): Promise<string | null> {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] ?? null);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface ResultViewerProps {
  beforeUrl: string;
  result: SwapResult | null;
  isGenerating: boolean;
  style: GarageStyle | null;
  manufacturerName: string;
  colorName?: string;
  windowOption?: string;
  onReset: () => void;
  onChangePhoto?: () => void;
  generationProgress?: number;
  generationElapsed?: number;
  companyId?: string;
  companyPhone?: string | null;
  companyName?: string;
}

export function ResultViewer({
  beforeUrl,
  result,
  isGenerating,
  style,
  manufacturerName,
  colorName,
  windowOption,
  onReset,
  onChangePhoto,
  generationProgress,
  generationElapsed,
  companyId,
  companyPhone,
  companyName,
}: ResultViewerProps) {
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [zipCode, setZipCode] = useState("");

  const afterUrl = result ? `data:image/png;base64,${result.imageBase64}` : null;

  const leadMutation = useMutation({
    mutationFn: async (data: { name: string; phone: string; email: string; zipCode: string }) => {
      const beforeBase64 = await blobUrlToBase64(beforeUrl);
      const afterBase64 = afterUrl ? afterUrl.replace("data:image/png;base64,", "") : null;
      return api.post("/api/leads", {
        name: data.name,
        email: data.email,
        phone: data.phone,
        zipCode: data.zipCode,
        styleName: style?.name,
        manufacturerName,
        colorName,
        windowOption,
        styleId: style?.id,
        ...(companyId ? { companyId } : {}),
        ...(beforeBase64 ? { beforeImageBase64: beforeBase64 } : {}),
        ...(afterBase64 ? { afterImageBase64: afterBase64 } : {}),
        source: "inline_quote_form",
      });
    },
    onSuccess: () => setSubmitted(true),
  });

  if (!result && !isGenerating) return null;

  const GENERATION_MESSAGES = [
    "Analyzing your home's architecture\u2026",
    "Placing the new garage door\u2026",
    "Matching lighting and shadows\u2026",
    "Refining edges and details\u2026",
    "Applying final color corrections\u2026",
    "Almost ready\u2026",
  ];
  const msgIdx = Math.floor(((generationElapsed ?? 0) / 4) % GENERATION_MESSAGES.length);
  const isLongWait = (generationElapsed ?? 0) > 75;

  const colorHex = colorName && style ? (style.colors.find((c) => c.name === colorName)?.hex ?? null) : null;

  const handleDownload = () => {
    if (!afterUrl || !style) return;
    const link = document.createElement("a");
    link.href = afterUrl;
    link.download = `941-garage-door-${style.id}-${Date.now()}.png`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => document.body.removeChild(link), 100);
  };

  const handleShare = async () => {
    if (!afterUrl || !style) return;
    try {
      const resp = await fetch(afterUrl);
      const blob = await resp.blob();
      const file = new File([blob], `941-garage-${style.id}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${manufacturerName} ${style.name} — 941 Garage Door`,
          text: `Check out this ${manufacturerName} ${style.name} on my home — previewed with 941 Garage Door visualizer`,
        });
        return;
      }
    } catch {
      // fall through to download
    }
    handleDownload();
  };

  return (
    <div className="rounded-3xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="border-b border-border p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                <Sparkles className="h-3 w-3" />
                AI Preview
              </span>
              {style ? (
                <span className="text-xs text-muted-foreground">
                  {manufacturerName} · {style.series}
                </span>
              ) : null}
            </div>
            <h2 className="font-display mt-1.5 text-2xl font-bold sm:text-3xl">
              {style ? style.name : "Generating…"}
            </h2>
            {style ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{style.tagline}</p>
            ) : null}
            {colorName || windowOption ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {colorName ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
                    {colorHex ? (
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-border/50"
                        style={{ backgroundColor: colorHex }}
                      />
                    ) : null}
                    {colorName}
                  </span>
                ) : null}
                {windowOption ? (
                  <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground">
                    {windowOption}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={onReset}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Try another style
            </Button>
            {onChangePhoto ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={onChangePhoto}
              >
                Change photo
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={handleShare}
              disabled={!result}
            >
              <Share2 className="mr-1.5 h-3.5 w-3.5" />
              Share
            </Button>
            <Button
              size="sm"
              className="rounded-full"
              onClick={handleDownload}
              disabled={!result}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Save photo
            </Button>
          </div>
        </div>
      </div>

      {/* Image area */}
      <div className="p-4 sm:p-6">
        {isGenerating || !afterUrl ? (
          <div className="relative overflow-hidden rounded-2xl bg-muted" style={{ aspectRatio: "16/10" }}>
            <img
              src={beforeUrl}
              alt="Your house"
              className="h-full w-full object-cover opacity-50"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[2px]">
              <div className="rounded-2xl bg-card/95 px-6 py-5 text-center shadow-lg ring-1 ring-border w-72">
                <div className="mb-3 flex justify-center gap-1.5">
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-primary" />
                </div>
                <div className="text-sm font-semibold">Crafting your new garage door</div>
                <div className="mt-1 min-h-[1.25rem] text-xs text-muted-foreground transition-all duration-700">
                  {GENERATION_MESSAGES[msgIdx]}
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                    style={{ width: `${generationProgress ?? 0}%` }}
                  />
                </div>
                <div className="mt-1.5 text-sm font-bold text-foreground">
                  {Math.round(generationProgress ?? 0)}%
                </div>
                {isLongWait ? (
                  <div className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    Taking longer than usual — please wait
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <>
            <BeforeAfter
              beforeUrl={beforeUrl}
              afterUrl={afterUrl}
              initialPosition={result?.doorCenterXPct != null ? result.doorCenterXPct * 100 : undefined}
            />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Drag the divider to compare before &amp; after
            </p>
          </>
        )}
      </div>

      {/* Get a quote CTA */}
      {result ? (
        <div className="border-t border-border bg-primary/5 p-4 sm:p-5">
          {submitted ? (
            <div className="flex items-center justify-center gap-3 py-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-sm font-semibold text-foreground">Thanks! We'll be in touch soon.</div>
                <div className="mt-0.5 text-xs text-muted-foreground">One of our experts will reach out shortly.</div>
              </div>
            </div>
          ) : !showForm ? (
            <div className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
              <div>
                <div className="text-sm font-semibold text-foreground">Love what you see?</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {companyName
                    ? `Contact ${companyName} for a free quote.`
                    : "Locally owned, serving SW Florida for 25 years."}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {companyPhone ? (
                  <a
                    href={`tel:${companyPhone}`}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                  >
                    <Phone className="h-4 w-4" />
                    Call Now
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-primary bg-background px-5 py-2.5 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary/10"
                >
                  <Mail className="h-4 w-4" />
                  Get a Free Quote
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!phone.replace(/\D/g, "").match(/^\d{7,}$/)) return;
                leadMutation.mutate({ name, phone, email, zipCode });
              }}
              className="space-y-3"
            >
              <div className="text-sm font-semibold text-foreground">Get a free quote for this door</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  type="tel"
                  placeholder="Phone number *"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <Input
                  type="email"
                  placeholder="Email (optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  placeholder="Zip code (optional)"
                  maxLength={5}
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  className="rounded-full gap-2"
                  disabled={leadMutation.isPending}
                >
                  <Send className="h-3.5 w-3.5" />
                  {leadMutation.isPending ? "Sending…" : "Send My Quote Request"}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
