/**
 * Lightweight document-head manager for our client-rendered SPA.
 *
 * The visualizer is multi-tenant: the same bundle is served on our own domain,
 * on /v/:slug, and on each subscriber's custom domain. So the right title,
 * description, social-share image and structured data depend on WHICH company
 * is being shown. This module rewrites the relevant <head> tags at runtime.
 *
 * Note: social scrapers (Facebook, iMessage, etc.) generally do NOT execute
 * JS, so they read the STATIC tags in index.html. Google, however, renders the
 * page, so dynamic per-company tags here improve organic search for the
 * business's own name. Keep meaningful defaults in index.html for sharing.
 */

export type JsonLd = Record<string, unknown>

export type HeadConfig = {
  title?: string
  description?: string
  canonical?: string
  /** Browser UI / theme color (usually the company's brand color). */
  themeColor?: string
  /** Absolute or root-relative social-share image. */
  image?: string
  imageAlt?: string
  ogType?: string
  url?: string
  siteName?: string
  /** One or more schema.org objects injected as <script type="application/ld+json">. */
  jsonLd?: JsonLd[]
}

const MANAGED = "data-seo-managed"

/** Resolve a possibly-relative URL to an absolute one for social/canonical use. */
function absolute(url: string | undefined): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url
  if (typeof window === "undefined") return url
  return new URL(url, window.location.origin).toString()
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute(attr, key)
    el.setAttribute(MANAGED, "")
    document.head.appendChild(el)
  }
  el.setAttribute("content", content)
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement("link")
    el.setAttribute("rel", rel)
    el.setAttribute(MANAGED, "")
    document.head.appendChild(el)
  }
  el.setAttribute("href", href)
}

/**
 * Apply a head configuration. Re-injects JSON-LD on every call (old managed
 * scripts are cleared first) so switching companies never stacks stale schema.
 */
export function setDocumentHead(config: HeadConfig): void {
  if (typeof document === "undefined") return

  const url = absolute(config.url) ?? (typeof window !== "undefined" ? window.location.href : undefined)
  const image = absolute(config.image)

  if (config.title) document.title = config.title
  if (config.description) {
    upsertMeta("name", "description", config.description)
    upsertMeta("property", "og:description", config.description)
    upsertMeta("name", "twitter:description", config.description)
  }
  if (config.title) {
    upsertMeta("property", "og:title", config.title)
    upsertMeta("name", "twitter:title", config.title)
  }
  if (config.ogType) upsertMeta("property", "og:type", config.ogType)
  if (config.siteName) upsertMeta("property", "og:site_name", config.siteName)
  if (url) {
    upsertMeta("property", "og:url", url)
    upsertLink("canonical", url)
  }
  if (image) {
    upsertMeta("property", "og:image", image)
    upsertMeta("name", "twitter:image", image)
    upsertMeta("name", "twitter:card", "summary_large_image")
  }
  if (config.imageAlt) upsertMeta("property", "og:image:alt", config.imageAlt)
  if (config.themeColor) upsertMeta("name", "theme-color", config.themeColor)

  // Clear and re-inject managed JSON-LD blocks.
  document.head
    .querySelectorAll(`script[type="application/ld+json"][${MANAGED}]`)
    .forEach((n) => n.remove())
  for (const block of config.jsonLd ?? []) {
    const script = document.createElement("script")
    script.type = "application/ld+json"
    script.setAttribute(MANAGED, "")
    script.textContent = JSON.stringify(block)
    document.head.appendChild(script)
  }
}
