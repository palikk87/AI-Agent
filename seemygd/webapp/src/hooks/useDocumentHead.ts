import { useEffect } from "react"
import { setDocumentHead, type HeadConfig } from "@/lib/seo"

/**
 * Declaratively manage the document <head> from a component. Re-applies
 * whenever the serialized config changes (e.g. company branding loads).
 */
export function useDocumentHead(config: HeadConfig | null | undefined): void {
  const key = config ? JSON.stringify(config) : ""
  useEffect(() => {
    if (config) setDocumentHead(config)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
