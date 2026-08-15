/**
 * Push the old Vibecode uploads/ folder into Supabase Storage.
 *
 *   bun scripts/upload-legacy-images.ts [path-to-uploads-dir]
 *
 * Defaults to ./uploads. Every company logo and hero banner that was written to
 * the Vibecode container's disk gets copied into the public `branding` bucket
 * under the same filename, then any Company row still pointing at the old
 * "/uploads/<file>" path is rewritten to the Supabase public URL.
 *
 * Why bother, when index.ts still serves /uploads/* from disk? Because that only
 * works for the files committed to the repo. Anything uploaded on Vibecode after
 * the project zip was taken exists solely on that container — this moves it
 * somewhere permanent before the container is destroyed.
 *
 * Safe to re-run: uploads are upserts and the DB update only touches rows whose
 * URL still starts with "/uploads/".
 */

import { readdir } from "node:fs/promises"
import { join, basename } from "node:path"
import { prisma } from "../src/prisma"
import { saveBrandingImage, contentTypeForExt, storageConfigured } from "../src/storage"

if (!storageConfigured) {
  console.error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set — otherwise this would just copy files onto local disk again."
  )
  process.exit(1)
}

const dir = process.argv[2] || join(process.cwd(), "uploads")

let files: string[]
try {
  files = await readdir(dir)
} catch {
  console.error(`Could not read ${dir}. Pass the path to the rescued uploads folder.`)
  process.exit(1)
}

const images = files.filter((f) => /\.(jpe?g|png|webp|gif|avif|svg)$/i.test(f))
if (images.length === 0) {
  console.log(`No images found in ${dir}. Nothing to do.`)
  process.exit(0)
}

console.log(`Uploading ${images.length} image(s) from ${dir}…\n`)

/** Old path → new public URL, for the database rewrite below. */
const moved = new Map<string, string>()

for (const file of images) {
  const name = basename(file)
  const ext = name.includes(".") ? name.split(".").pop()! : "bin"
  try {
    const bytes = Buffer.from(await Bun.file(join(dir, file)).arrayBuffer())
    const url = await saveBrandingImage(name, bytes, contentTypeForExt(ext))
    moved.set(`/uploads/${name}`, url)
    console.log(`  ✓ ${name}`)
  } catch (err) {
    console.error(`  ✗ ${name}: ${(err as Error).message}`)
  }
}

// Repoint any Company row still referencing the old local path.
console.log("\nUpdating company branding URLs…")
let updated = 0

for (const [oldPath, newUrl] of moved) {
  const logos = await prisma.company.updateMany({
    where: { logoUrl: oldPath },
    data: { logoUrl: newUrl },
  })
  const heroes = await prisma.company.updateMany({
    where: { heroImageUrl: oldPath },
    data: { heroImageUrl: newUrl },
  })
  updated += logos.count + heroes.count
}

console.log(`${updated} branding URL(s) repointed to Supabase Storage.`)

const stragglers = await prisma.company.count({
  where: {
    OR: [
      { logoUrl: { startsWith: "/uploads/" } },
      { heroImageUrl: { startsWith: "/uploads/" } },
    ],
  },
})
if (stragglers > 0) {
  console.warn(
    `\nWarning: ${stragglers} company row(s) still point at /uploads/ paths with no matching file in ${dir}.` +
      `\nThose images are served from the repo copy — check them in the dashboard.`
  )
}

await prisma.$disconnect()
