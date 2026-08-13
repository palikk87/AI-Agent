import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Wrench } from "lucide-react";
import { Hero } from "@/components/garage/Hero";
import { StyleWizard } from "@/components/garage/StyleWizard";
import { ResultViewer } from "@/components/garage/ResultViewer";
import { RepairEstimator } from "@/components/repair/RepairEstimator";

import { garageApi, type DoorSize, type GarageStyle, type SwapResult } from "@/lib/garage-api";
import { DesignHistory, type SavedDesign } from "@/components/garage/DesignHistory";
import { useDocumentHead } from "@/hooks/useDocumentHead";

const Index = () => {
  useDocumentHead({
    title: "See Any Garage Door on Your Own Home — Free AI Visualizer",
    description:
      "Upload a photo of your home and instantly see how different garage doors look on it. Free AI tool — no account needed, results in seconds.",
    themeColor: "#091F3B",
    ogType: "website",
    siteName: "941 Garage Door Visualizer",
    image: "/og-thumbnail.jpg",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: "Garage Door Visualizer",
        applicationCategory: "DesignApplication",
        operatingSystem: "Web",
        url: "https://visualizer.941garagedoor.com/",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description:
          "Free AI tool that shows how a new garage door looks on a photo of your home.",
      },
    ],
  });

  const [tool, setTool] = useState<"design" | "repair">("design");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<GarageStyle | null>(null);
  const [selectedColorName, setSelectedColorName] = useState<string | undefined>(undefined);
  const [selectedWindowOption, setSelectedWindowOption] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<SwapResult | null>(null);
  const [detectedDoorSize, setDetectedDoorSize] = useState<DoorSize | undefined>(undefined);
  const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>([]);
  const [activeDesignId, setActiveDesignId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationElapsed, setGenerationElapsed] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);

  const catalogQuery = useQuery({
    queryKey: ["garage-catalog"],
    queryFn: garageApi.catalog,
    staleTime: Infinity,
  });

  const detectMutation = useMutation({
    mutationFn: (file: File) => garageApi.detect(file),
    onSuccess: (data) => setDetectedDoorSize(data),
  });

  useEffect(() => {
    if (!imageFile) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const swapMutation = useMutation({
    mutationFn: async ({
      style,
      colorId,
      windowOptionId,
    }: {
      style: GarageStyle;
      colorId?: string;
      windowOptionId?: string;
    }) => {
      if (!imageFile) throw new Error("Photo required");
      return garageApi.swap(imageFile, style.id, colorId, windowOptionId);
    },
    onSuccess: (data) => {
      setGenerationProgress(100);
      setResult(data);
      if (data.detectedDoorSize) setDetectedDoorSize(data.detectedDoorSize);
      toast.success("Your new garage door is ready");
      const newDesign: SavedDesign = {
        id: crypto.randomUUID(),
        result: data,
        style: selectedStyle!,
        colorName: selectedColorName,
        windowOption: selectedWindowOption,
        manufacturerName: catalogQuery.data?.manufacturers.find(m => m.id === selectedStyle?.manufacturer)?.name ?? "",
      };
      setSavedDesigns((prev) => [...prev, newDesign]);
      setActiveDesignId(newDesign.id);
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    },
  });

  useEffect(() => {
    if (!swapMutation.isPending) {
      if (swapMutation.isSuccess) {
        setGenerationProgress(100);
        setTimeout(() => setGenerationProgress(0), 1500);
      }
      return;
    }
    setGenerationProgress(3);
    const interval = setInterval(() => {
      setGenerationProgress((prev) => {
        const multiplier = prev < 40 ? 0.12 : prev < 70 ? 0.07 : 0.03;
        return Math.min(94, prev + (94 - prev) * multiplier);
      });
    }, 300);
    return () => clearInterval(interval);
  }, [swapMutation.isPending, swapMutation.isSuccess]);

  useEffect(() => {
    if (!swapMutation.isPending) {
      setGenerationElapsed(0);
      return;
    }
    setGenerationElapsed(0);
    const timer = setInterval(() => setGenerationElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [swapMutation.isPending]);

  const handleFileChange = (file: File | null) => {
    setImageFile(file);
    setResult(null);
    swapMutation.reset();
    if (file) detectMutation.mutate(file);
    else setDetectedDoorSize(undefined);
  };

  const handleGenerate = (
    style: GarageStyle,
    colorId?: string,
    windowOptionId?: string
  ) => {
    if (!imageFile) {
      toast.error("Upload a photo of your home first");
      return;
    }
    setSelectedStyle(style);
    const effectiveColorId = colorId ?? style.colors[0]?.id;
    const effectiveWindowId = windowOptionId ?? style.windowOptions[0]?.id;
    setSelectedColorName(style.colors.find((c) => c.id === effectiveColorId)?.name);
    setSelectedWindowOption(style.windowOptions.find((w) => w.id === effectiveWindowId)?.name);
    setResult(null);
    swapMutation.mutate({ style, colorId, windowOptionId });
    setTimeout(() => {
      document.getElementById("styles")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleReset = () => {
    setResult(null);
    setSelectedColorName(undefined);
    setSelectedWindowOption(undefined);
    setDetectedDoorSize(undefined);
    swapMutation.reset();
    // Do NOT clear savedDesigns — keep history visible while user picks another style
  };

  const handleChangePhoto = () => {
    setImageFile(null);
    setResult(null);
    setSelectedColorName(undefined);
    setSelectedWindowOption(undefined);
    setDetectedDoorSize(undefined);
    swapMutation.reset();
    setSavedDesigns([]);
    setActiveDesignId(null);
  };

  const handleSelectDesign = (design: SavedDesign) => {
    setResult(design.result);
    setSelectedStyle(design.style);
    setSelectedColorName(design.colorName);
    setSelectedWindowOption(design.windowOption);
    setActiveDesignId(design.id);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const manufacturerName = useMemo(() => {
    if (!selectedStyle || !catalogQuery.data) return "";
    return (
      catalogQuery.data.manufacturers.find(
        (m) => m.id === selectedStyle.manufacturer
      )?.name ?? ""
    );
  }, [selectedStyle, catalogQuery.data]);

  return (
    <div
      className="relative min-h-screen text-foreground"
      style={{ backgroundColor: 'hsl(38 22% 97%)' }}
    >

      <Hero />

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-5 sm:px-6" id="styles">
        {/* Tool switcher — big, obvious two-card control */}
        <div className="mb-6">
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
            What can we help you with today?
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([
              { id: "design" as const, label: "Design a New Door", sub: "See a new door on your home", icon: Sparkles },
              { id: "repair" as const, label: "Estimate a Repair", sub: "Get a price to fix your door", icon: Wrench },
            ]).map((seg) => {
              const active = tool === seg.id;
              const Icon = seg.icon;
              return (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setTool(seg.id)}
                  aria-pressed={active}
                  className={`group flex min-h-[68px] items-center gap-3 rounded-2xl border-2 px-5 py-4 text-left transition-all ${
                    active
                      ? "scale-[1.02] border-accent bg-white shadow-lg"
                      : "border-border bg-white/70 hover:border-accent/40 hover:bg-white"
                  }`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      active ? "bg-accent text-white" : "bg-muted text-muted-foreground group-hover:text-accent"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-base font-bold leading-tight ${active ? "text-accent" : "text-foreground"}`}>
                      {seg.label}
                    </span>
                    <span className="block text-xs leading-tight text-muted-foreground">{seg.sub}</span>
                  </span>
                  {active ? (
                    <span className="ml-auto hidden shrink-0 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white sm:inline-block">
                      Selected
                    </span>
                  ) : (
                    <span className="ml-auto hidden shrink-0 text-xs font-semibold text-muted-foreground sm:inline-block">
                      Tap to switch →
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {tool === "repair" ? (
          <RepairEstimator companyId={undefined} brandColor="#ff7716" company={null} />
        ) : (
        <>
        {!result && (
          <div className="mb-5 text-center">
            <h1 className="font-display text-balance text-2xl font-bold tracking-tight sm:text-3xl">
              See a new garage door on your home — free.
            </h1>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
              Upload a photo, pick a style, and get a photorealistic AI preview in seconds.
            </p>
          </div>
        )}

        {result ? (
          <div ref={resultRef}>
            <ResultViewer
              beforeUrl={imageUrl ?? ""}
              result={result}
              isGenerating={false}
              style={selectedStyle}
              manufacturerName={manufacturerName}
              onReset={handleReset}
              onChangePhoto={handleChangePhoto}
              colorName={selectedColorName}
              windowOption={selectedWindowOption}
              generationProgress={generationProgress}
              generationElapsed={generationElapsed}
            />
          </div>
        ) : catalogQuery.isLoading ? (
          <WizardSkeleton />
        ) : catalogQuery.data ? (
          <StyleWizard
            imageUrl={imageUrl}
            catalog={catalogQuery.data}
            onGenerate={handleGenerate}
            onChangePhoto={handleChangePhoto}
            onPhotoChange={handleFileChange}
            isGenerating={swapMutation.isPending}
            generationProgress={generationProgress}
            generationElapsed={generationElapsed}
            doorSize={detectedDoorSize}
          />
        ) : (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Could not load the door catalog. Check the API tab for the OpenAI
            integration and refresh.
          </div>
        )}

        {savedDesigns.length > 0 ? (
          <div className="mt-4">
            <DesignHistory
              designs={savedDesigns}
              activeId={activeDesignId}
              onSelect={handleSelectDesign}
              onClear={() => { setSavedDesigns([]); setActiveDesignId(null); setResult(null); swapMutation.reset(); }}
              onAddNew={result ? handleReset : undefined}
            />
          </div>
        ) : null}
        </>
        )}
      </main>

      <footer className="border-t border-border bg-card/50">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-foreground">Garage Door Visualizer</span>
              </div>
              <div className="text-xs text-muted-foreground">
                See a new garage door on your home instantly — free AI preview tool.
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              Photorealistic AI renderings
            </span>
          </div>
          <p className="mt-6 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
            Visualizations are AI-generated and meant only to give a general idea — not a literal portrayal.
            The AI may alter the door, other parts of your photo, colors, or details, and the real product
            and installed result may differ. Provided “as is” with no warranty; use at your own risk. See our{" "}
            <Link to="/legal" className="underline hover:text-primary transition-colors">Disclaimer &amp; Privacy Policy</Link>.
          </p>
        </div>
      </footer>
    </div>
  );
};



function WizardSkeleton() {
  return (
    <div className="aspect-[4/3] w-full animate-pulse overflow-hidden rounded-2xl bg-muted sm:aspect-[16/10]" />
  );
}

export default Index;
