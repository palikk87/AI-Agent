import { useCallback, useRef, useState } from "react";
import { Camera, Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PhotoUploaderProps {
  imageUrl: string | null;
  imageFile: File | null;
  onChange: (file: File | null) => void;
}

export function PhotoUploader({ imageUrl, onChange }: PhotoUploaderProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) return;
      onChange(file);
    },
    [onChange]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="relative">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files?.[0])}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files?.[0])}
      />

      {imageUrl ? (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm animate-in fade-in duration-300">
          <div className="aspect-[16/10] w-full">
            <img
              src={imageUrl}
              alt="Your house"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-black/55 to-transparent p-3">
            <div className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground shadow-sm">
              <ImageIcon className="h-3.5 w-3.5" />
              Your house
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 gap-1.5 rounded-full"
              onClick={() => onChange(null)}
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInput.current?.click()}
          className={cn(
            "group relative cursor-pointer overflow-hidden rounded-2xl border shadow-sm transition-all duration-200",
            dragOver
              ? "border-accent ring-2 ring-accent/40"
              : "border-border hover:border-primary/40 hover:shadow-md"
          )}
        >
          {/* Soft brand gradient wash */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-background to-secondary/50" />

          {/* Faint house + garage line drawing so the panel never looks empty */}
          <svg
            viewBox="0 0 400 150"
            preserveAspectRatio="xMidYMax slice"
            className="absolute inset-x-0 bottom-0 h-2/3 w-full text-primary/[0.07]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          >
            <path d="M70 150 V70 L200 18 L330 70 V150" />
            <path d="M150 150 V92 H250 V150" />
            <line x1="150" y1="112" x2="250" y2="112" />
            <line x1="150" y1="131" x2="250" y2="131" />
            <line x1="200" y1="92" x2="200" y2="150" />
            <rect x="95" y="92" width="34" height="30" rx="2" />
            <rect x="271" y="92" width="34" height="30" rx="2" />
          </svg>

          <div className="relative flex aspect-[16/10] w-full flex-col items-center justify-center p-6 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/25 transition-transform duration-200 group-hover:-translate-y-1">
              <Upload className="h-7 w-7" />
            </div>
            <h3 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
              Upload a photo of your home
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              A clear, front-facing shot of your garage works best — we'll handle the rest.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <Button
                type="button"
                size="lg"
                className="rounded-full bg-accent px-6 font-semibold text-white shadow-sm hover:bg-accent/90"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInput.current?.click();
                }}
              >
                <Upload className="mr-1.5 h-4 w-4" />
                Choose file
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="rounded-full bg-background px-6"
                onClick={(e) => {
                  e.stopPropagation();
                  cameraInput.current?.click();
                }}
              >
                <Camera className="mr-1.5 h-4 w-4" />
                Take photo
              </Button>
            </div>
            <p className="mt-5 text-xs text-muted-foreground/80">
              JPG or PNG · up to 10 MB · or drag &amp; drop one here
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
