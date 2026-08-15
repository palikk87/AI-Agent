import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Lock, ShieldCheck, CreditCard } from "lucide-react"
import { createSquareCard, type SquareCard } from "@/lib/squarePayments"

interface CheckoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planName: string
  planPrice: string
  /** Charges the tokenized card. Resolves on success, rejects with an Error on failure. */
  onPay: (sourceId: string) => Promise<void>
}

/**
 * Payment dialog with Square's card fields embedded directly inline (Web
 * Payments SDK). The customer enters their card and pays without ever leaving
 * the app — no redirect, no "I've completed payment" step. The backend only
 * activates the subscription once Square confirms the charge succeeded.
 */
export function CheckoutDialog({ open, onOpenChange, planName, planPrice, onPay }: CheckoutDialogProps) {
  const cardContainerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<SquareCard | null>(null)
  const [loadingCard, setLoadingCard] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize the Square card form whenever the dialog opens.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingCard(true)
    setError(null)

    // Wait a tick so the container is mounted in the DOM.
    const timer = setTimeout(async () => {
      try {
        if (!cardContainerRef.current) return
        const card = await createSquareCard(cardContainerRef.current)
        if (cancelled) {
          await card.destroy().catch(() => {})
          return
        }
        cardRef.current = card
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load the payment form.")
        }
      } finally {
        if (!cancelled) setLoadingCard(false)
      }
    }, 50)

    return () => {
      cancelled = true
      clearTimeout(timer)
      if (cardRef.current) {
        cardRef.current.destroy().catch(() => {})
        cardRef.current = null
      }
    }
  }, [open])

  async function handlePay() {
    if (!cardRef.current || processing) return
    setProcessing(true)
    setError(null)
    try {
      const result = await cardRef.current.tokenize()
      if (result.status !== "OK" || !result.token) {
        setError(result.errors?.[0]?.message ?? "Please check your card details and try again.")
        return
      }
      await onPay(result.token)
      // Success — parent closes the dialog.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed. Please try again.")
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (processing ? null : onOpenChange(o))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="font-display text-2xl tracking-tight">
            Subscribe to {planName}
          </DialogTitle>
          <DialogDescription>
            You'll be charged {planPrice}. Enter your card below — payment is securely processed by Square.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Square injects the card iframe into this container */}
          <div className="flex min-h-[52px] items-center rounded-xl border border-border bg-white px-3 py-1 shadow-sm">
            <div ref={cardContainerRef} className="w-full" />
            {loadingCard ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading secure card form…
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <Button
            onClick={handlePay}
            disabled={loadingCard || processing}
            className="h-11 w-full text-sm font-semibold"
          >
            {processing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" />
            )}
            {processing ? "Processing…" : `Pay ${planPrice}`}
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Secured by Square. We never see your card number.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
