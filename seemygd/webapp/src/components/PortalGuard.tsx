import { useEffect, useState } from "react"
import { isCustomDomain, portalUrlForCurrentRoute } from "@/lib/portal"
import { PageLoader } from "@/components/PageLoader"

/**
 * Wraps owner-only pages (login, signup, dashboard, admin). If the page is
 * opened on a customer's custom domain, we send the visitor to the same route
 * on the canonical portal domain, where authentication is reliable. On the
 * portal (or dev/preview) it just renders the page as normal.
 */
export function PortalGuard({ children }: { children: React.ReactNode }) {
  const [redirecting, setRedirecting] = useState(() => isCustomDomain())

  useEffect(() => {
    if (isCustomDomain()) {
      setRedirecting(true)
      window.location.replace(portalUrlForCurrentRoute())
    }
  }, [])

  if (redirecting) return <PageLoader />
  return <>{children}</>
}
