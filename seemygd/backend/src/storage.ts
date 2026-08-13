import { createClient } from "@supabase/supabase-js"

/**
 * Branding image storage (company logos + hero banners).
 *
 * On Vibecode these were written to a local ./uploads directory that survived
 * because the container had a persistent disk. Most hosts give you an ephemeral
 * filesystem instead — every deploy would silently wipe customer logos — so
 * uploads now go to a public Supabase Storage bucket.
 *
 * Local-disk writing is kept as an automatic fallback so `bun dev` works with no
 * Supabase credentials, and so the pre-existing /uploads/* URLs already stored in
 * the database keep resolving (those files are served by the /uploads/:filename
 * route in index.ts).
 */

const SUPABASE_URL = process.env.SUPABASE_URL || ""
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
export const BRANDING_BUCKET = process.env.SUPABASE_BRANDING_BUCKET || "branding"

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

export const storageConfigured = supabase !== null

/**
 * Persist a branding image and return the URL to store on the Company row.
 *
 * Returns an absolute Supabase public URL when storage is configured, or a
 * relative "/uploads/<file>" path when falling back to local disk.
 */
export async function saveBrandingImage(
  filename: string,
  bytes: Buffer,
  contentType: string
): Promise<string> {
  if (supabase) {
    const { error } = await supabase.storage
      .from(BRANDING_BUCKET)
      .upload(filename, bytes, {
        contentType,
        // Branding filenames already carry a timestamp, so a collision means a
        // retry of the same upload — overwrite rather than fail the request.
        upsert: true,
        cacheControl: "31536000",
      })

    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`)
    }

    const { data } = supabase.storage.from(BRANDING_BUCKET).getPublicUrl(filename)
    return data.publicUrl
  }

  const uploadsDir = process.cwd() + "/uploads/"
  await Bun.write(`${uploadsDir}${filename}`, bytes)
  return `/uploads/${filename}`
}

/** Best-effort content type from a file extension. */
export function contentTypeForExt(ext: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    avif: "image/avif",
  }
  return map[ext.toLowerCase()] || "application/octet-stream"
}
