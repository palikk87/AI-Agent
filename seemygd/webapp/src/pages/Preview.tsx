import { useSearchParams } from "react-router-dom"
import Visualizer, { type PreviewParams } from "./Visualizer"

/**
 * Admin-only sales preview page.
 *
 * URL shape: /preview?site=<host>&expires=<epochMs>&sig=<hmac>
 *
 * These links are generated in the admin panel and shared with prospects to
 * show them a branded version of the visualizer, scraped live from their site.
 * The token is signed and self-expiring — nothing is stored, and once it lapses
 * the backend refuses to render it. Regular clients never see or create these.
 */
export default function Preview() {
  const [params] = useSearchParams()
  const site = params.get("site") ?? ""
  const expires = params.get("expires") ?? ""
  const sig = params.get("sig") ?? ""

  if (!site || !expires || !sig) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-white text-xl font-semibold mb-2">Invalid preview link</h1>
          <p className="text-gray-400">
            This preview link is missing information. Please generate a fresh link from the admin
            dashboard.
          </p>
        </div>
      </div>
    )
  }

  const preview: PreviewParams = { site, expires, sig }
  return <Visualizer preview={preview} />
}
