import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { PageLoader } from "@/components/PageLoader"
import { Navigate } from "react-router-dom"
import { VisualizerPage } from "./lazyPages"

/**
 * Resolver for the "/" route.
 *
 * Multi-tenant behavior: if the app is being served on a customer's custom
 * domain (one they've saved in their dashboard and pointed at us via DNS), we
 * render THAT company's visualizer at the domain root. On our own
 * marketing/app domain no company matches, so the root is not a page of its
 * own: seemygd.com is the only marketing page, so we send visitors to the tool.
 */
export default function Root() {
  const host = typeof window !== "undefined" ? window.location.host : ""

  const { data, isLoading } = useQuery({
    queryKey: ["resolve-host", host],
    queryFn: () =>
      api.get<{ id: string } | null>(
        `/api/companies/resolve-by-host?host=${encodeURIComponent(host)}`
      ),
    staleTime: Infinity,
    retry: false,
  })

  // Brief neutral splash while we resolve (cached after first load).
  if (isLoading) {
    return <PageLoader />
  }

  if (data?.id) {
    return <VisualizerPage companyId={data.id} />
  }

  return <Navigate to="/tool" replace />
}
