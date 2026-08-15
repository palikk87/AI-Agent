import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Phone, Mail, MapPin, User, CheckCircle2 } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import type { Lead } from "../../../../backend/src/types"

interface RepairRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  brandColor: string
  companyId?: string
  companyName?: string | null
  companyPhone?: string | null
  estimateTotal: number
  repairSummary: string
}

export function RepairRequestDialog({
  open,
  onOpenChange,
  brandColor,
  companyId,
  companyName,
  companyPhone,
  estimateTotal,
  repairSummary,
}: RepairRequestDialogProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [phoneError, setPhoneError] = useState("")

  const submitMutation = useMutation({
    mutationFn: (data: { name: string; phone: string; email: string; zipCode: string }) =>
      api.post<Lead>("/api/leads", {
        name: data.name,
        email: data.email,
        phone: data.phone,
        zipCode: data.zipCode,
        source: "repair_estimator",
        serviceType: "repair",
        estimateTotal,
        repairSummary,
        ...(companyId ? { companyId } : {}),
      }),
  })

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, "")
    let formatted = digits
    if (digits.length >= 4 && digits.length <= 6) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    } else if (digits.length > 6) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
    } else if (digits.length > 0) {
      formatted = `(${digits.slice(0, 3)}`
    }
    setPhone(formatted)
    if (phoneError) setPhoneError("")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const digits = phone.replace(/\D/g, "")
    if (digits.length < 10) {
      setPhoneError("Please enter a valid 10-digit phone number")
      return
    }
    submitMutation.mutate({ name, phone, email, zipCode })
  }

  const bizName = companyName ?? "our team"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0 [&>button]:hidden">
        {submitMutation.isSuccess ? (
          <div className="flex flex-col items-center px-8 py-10 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">We'll be in touch soon!</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              A technician from {bizName} will call you shortly to confirm your repair and schedule a visit.
            </p>
            {companyPhone ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Prefer not to wait? Call us at{" "}
                <a href={`tel:${companyPhone}`} className="font-semibold hover:underline" style={{ color: brandColor }}>
                  {companyPhone}
                </a>
              </p>
            ) : null}
            <Button
              className="mt-7 h-11 w-full rounded-full text-sm font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: brandColor }}
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="px-6 pb-5 pt-6 text-white" style={{ backgroundColor: brandColor }}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/60">
                Free Service Visit · No Obligation
              </div>
              <h2 className="text-xl font-bold leading-snug">
                Book your repair with {bizName}
              </h2>
              <p className="mt-2 text-sm text-white/80">
                Your estimate is{" "}
                <span className="font-bold text-white">${estimateTotal.toLocaleString()}</span>. Leave your number and a
                technician will call to confirm.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="px-6 pb-6 pt-5">
              <div className="mb-4">
                <Label htmlFor="repair-phone" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
                  <Phone className="h-3.5 w-3.5" style={{ color: brandColor }} />
                  Phone Number
                  <span className="ml-0.5" style={{ color: brandColor }}>*</span>
                </Label>
                <Input
                  id="repair-phone"
                  type="tel"
                  placeholder="(555) 000-0000"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="h-12 rounded-xl text-base font-medium"
                  autoFocus
                  autoComplete="tel"
                />
                {phoneError ? <p className="mt-1.5 text-xs text-destructive">{phoneError}</p> : null}
              </div>

              <div className="mb-4">
                <Label htmlFor="repair-name" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Your Name
                </Label>
                <Input
                  id="repair-name"
                  type="text"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 rounded-xl"
                  autoComplete="name"
                />
              </div>

              <div className="mb-5 grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="repair-email" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    Email
                  </Label>
                  <Input
                    id="repair-email"
                    type="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 rounded-xl"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <Label htmlFor="repair-zip" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    Zip Code
                  </Label>
                  <Input
                    id="repair-zip"
                    type="text"
                    placeholder="34202"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                    className="h-10 rounded-xl"
                    inputMode="numeric"
                    autoComplete="postal-code"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-full text-base font-bold text-white shadow-sm hover:opacity-90"
                style={{ backgroundColor: brandColor }}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? "Sending…" : "Request My Service Visit"}
              </Button>

              {submitMutation.isError ? (
                <p className="mt-2.5 text-center text-xs text-destructive">
                  Something went wrong. Please try again{companyPhone ? ` or call ${companyPhone}` : ""}.
                </p>
              ) : null}

              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  No thanks, I'll decide later
                </button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
