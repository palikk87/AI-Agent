import { Loader2 } from "lucide-react"

/** Lightweight branded splash shown while a route chunk loads. */
export function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  )
}
