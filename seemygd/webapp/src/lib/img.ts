/**
 * Rewrites image URLs from common CDNs to request a smaller, web-optimized
 * size. Big external images (e.g. a brand's 1500px hero PNG) are the main thing
 * that makes the visualizer feel slow — this trims them to what's actually
 * needed for display. Unknown hosts pass through unchanged.
 */
export function optimizeImageUrl(
  url: string | null | undefined,
  width = 1280,
  quality = 70
): string | null {
  if (!url) return null
  // Don't touch data URIs or our own uploaded (already-compressed) assets.
  if (url.startsWith("data:") || url.startsWith("/uploads/")) return url
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()

    // Squarespace serves resized variants via ?format=<width>w
    if (host.includes("squarespace.com") || host.includes("sqspcdn") || host.includes("squarespace-cdn.com")) {
      u.searchParams.set("format", `${width}w`)
      return u.toString()
    }

    // Unsplash supports on-the-fly resize + format
    if (host.includes("images.unsplash.com")) {
      u.searchParams.set("w", String(width))
      u.searchParams.set("q", String(quality))
      u.searchParams.set("auto", "format")
      return u.toString()
    }

    return url
  } catch {
    return url
  }
}

/**
 * Downscales + compresses a user-uploaded photo in the browser before we send
 * it to the backend / render it. Phone photos are routinely 4000×3000px and
 * 5–12 MB — uploading and rendering those raw is the main reason the visualizer
 * feels slow. We cap the longest edge and re-encode as JPEG, which typically
 * cuts the file to a few hundred KB with no visible quality loss for previews.
 *
 * Falls back to the original file if anything goes wrong (unreadable, decode
 * failure, canvas blocked, or the result somehow ends up larger).
 */
export async function compressImageFile(
  file: File,
  maxEdge = 1600,
  quality = 0.85
): Promise<File> {
  if (!file.type.startsWith("image/")) return file
  try {
    const bitmap = await loadBitmap(file)
    const { width, height } = bitmap
    const scale = Math.min(1, maxEdge / Math.max(width, height))
    // Already small enough — don't re-encode (avoids growing tiny PNGs).
    if (scale === 1 && file.size < 1_500_000) {
      closeBitmap(bitmap)
      return file
    }

    const targetW = Math.round(width * scale)
    const targetH = Math.round(height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext("2d")
    if (!ctx) { closeBitmap(bitmap); return file }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)
    closeBitmap(bitmap)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    )
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg"
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified })
  } catch {
    return file
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file)
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error("decode failed"))
      img.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function closeBitmap(bitmap: ImageBitmap | HTMLImageElement) {
  if (typeof ImageBitmap !== "undefined" && bitmap instanceof ImageBitmap) {
    bitmap.close()
  }
}
