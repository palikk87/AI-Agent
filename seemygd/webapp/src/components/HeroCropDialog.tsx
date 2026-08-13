import { useCallback, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

// Wide desktop-hero framing so the saved photo matches how the Visualizer
// renders it with `cover`.
const HERO_ASPECT = 16 / 9

type HeroCropDialogProps = {
  open: boolean
  /** Object URL (or data URL) of the file the user picked. */
  imageSrc: string | null
  /** Whether the confirmed crop is currently uploading. */
  saving: boolean
  /** Called with the pixel crop area when the user confirms. */
  onConfirm: (croppedAreaPixels: Area) => void
  /** Called when the user cancels / closes the dialog without cropping. */
  onCancel: () => void
}

export function HeroCropDialog({
  open,
  imageSrc,
  saving,
  onConfirm,
  onCancel,
}: HeroCropDialogProps) {
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState<number>(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  // Reset the framing each time a new image opens so leftover zoom/pan from a
  // previous crop doesn't carry over.
  const handleOpenChange = (next: boolean) => {
    if (!next && !saving) onCancel()
  }

  const handleConfirm = () => {
    if (croppedAreaPixels) onConfirm(croppedAreaPixels)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">Frame your background photo</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Drag to reposition and use the slider to zoom. This controls how your
            photo is framed behind your visualizer.
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full aspect-video overflow-hidden rounded-lg bg-black">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={HERO_ASPECT}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              restrictPosition
            />
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground/80">Zoom</span>
            <span className="text-xs text-muted-foreground">{zoom.toFixed(1)}x</span>
          </div>
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.1}
            onValueChange={(v) => setZoom(v[0] ?? 1)}
            disabled={saving}
          />
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saving}
            className="border-border text-foreground/80 hover:bg-muted hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !croppedAreaPixels}
            className="bg-primary hover:bg-primary/90"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
