import type { Area } from "react-easy-crop"

/**
 * Produces a cropped JPEG File from a source image URL and the pixel crop area
 * reported by react-easy-crop (`croppedAreaPixels`). Draws the selected region
 * onto a canvas at its native resolution and re-encodes as JPEG.
 *
 * This is fed to the existing hero upload flow so the server-side AI cleanup
 * still runs on the (now pre-framed) photo.
 */
export async function getCroppedImg(
  imageSrc: string,
  croppedAreaPixels: Area,
  fileName = "hero.jpg",
  quality = 0.9
): Promise<File> {
  const image = await loadImage(imageSrc)

  const canvas = document.createElement("canvas")
  canvas.width = Math.round(croppedAreaPixels.width)
  canvas.height = Math.round(croppedAreaPixels.height)
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not get canvas context")

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height
  )

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  )
  if (!blob) throw new Error("Could not create cropped image")

  return new File([blob], fileName, { type: "image/jpeg", lastModified: Date.now() })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Failed to load image for cropping"))
    img.src = src
  })
}
