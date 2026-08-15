import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Phone, Mail, MapPin, User, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { Lead } from "../../../../backend/src/types";

interface LeadCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  styleName?: string;
  manufacturerName?: string;
  colorName?: string;
  styleId?: string;
  windowOption?: string;
  companyId?: string;
}

export function LeadCaptureDialog({
  open,
  onOpenChange,
  styleName,
  manufacturerName,
  colorName,
  styleId,
  windowOption,
  companyId,
}: LeadCaptureDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const submitMutation = useMutation({
    mutationFn: (data: { name: string; phone: string; email: string; zipCode: string }) =>
      api.post<Lead>("/api/leads", {
        name: data.name,
        email: data.email,
        phone: data.phone,
        zipCode: data.zipCode,
        styleName,
        manufacturerName,
        colorName,
        styleId,
        windowOption,
        ...(companyId ? { companyId } : {}),
        source: "after_generation",
      }),
  });

  const handlePhoneChange = (value: string) => {
    // Format phone as user types
    const digits = value.replace(/\D/g, "");
    let formatted = digits;
    if (digits.length >= 4 && digits.length <= 6) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else if (digits.length > 6) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    } else if (digits.length > 0) {
      formatted = `(${digits.slice(0, 3)}`;
    }
    setPhone(formatted);
    if (phoneError) setPhoneError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setPhoneError("Please enter a valid 10-digit phone number");
      return;
    }
    submitMutation.mutate({ name, phone, email, zipCode });
  };

  const handleDismiss = () => {
    onOpenChange(false);
  };

  const doorLabel = styleName
    ? manufacturerName
      ? `${manufacturerName} ${styleName}`
      : styleName
    : "this door";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0 [&>button]:hidden">
        {submitMutation.isSuccess ? (
          /* Success state */
          <div className="flex flex-col items-center px-8 py-10 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="font-display text-2xl font-bold text-foreground">We'll be in touch soon!</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              One of our experts will call you shortly to discuss getting the{" "}
              <span className="font-semibold text-foreground">{doorLabel}</span> installed on your home.
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Prefer not to wait? Call us directly at{" "}
              <a href="tel:9414047235" className="font-semibold text-primary hover:underline">
                (941) 404-7235
              </a>
            </p>
            <Button
              className="mt-7 h-11 w-full rounded-full text-sm font-semibold"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </div>
        ) : (
          /* Form state */
          <>
            {/* Dark header */}
            <div className="bg-foreground px-6 pb-5 pt-6 text-background">
              <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-background/50">
                Free Quote · No Obligation
              </div>
              <h2 className="font-display text-xl font-bold leading-snug">
                You're one step away from getting the{" "}
                <span className="text-primary">{doorLabel}</span>{" "}
                on your home.
              </h2>
              <p className="mt-2 text-sm text-background/70">
                Leave your number and a local expert will call you — usually within the hour.
              </p>
            </div>

            {/* Form body */}
            <form onSubmit={handleSubmit} className="px-6 pb-6 pt-5">
              {/* Phone — most prominent */}
              <div className="mb-4">
                <Label htmlFor="lead-phone" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  Phone Number
                  <span className="ml-0.5 text-primary">*</span>
                </Label>
                <Input
                  id="lead-phone"
                  type="tel"
                  placeholder="(555) 000-0000"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  className="h-12 rounded-xl border-border text-base font-medium focus:border-primary focus:ring-primary"
                  autoFocus
                  autoComplete="tel"
                />
                {phoneError ? (
                  <p className="mt-1.5 text-xs text-destructive">{phoneError}</p>
                ) : null}
              </div>

              {/* Name */}
              <div className="mb-4">
                <Label htmlFor="lead-name" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Your Name
                </Label>
                <Input
                  id="lead-name"
                  type="text"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 rounded-xl border-border"
                  autoComplete="name"
                />
              </div>

              {/* Email + Zip side by side */}
              <div className="mb-5 grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="lead-email" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    Email
                  </Label>
                  <Input
                    id="lead-email"
                    type="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 rounded-xl border-border"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <Label htmlFor="lead-zip" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    Zip Code
                  </Label>
                  <Input
                    id="lead-zip"
                    type="text"
                    placeholder="34202"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                    className="h-10 rounded-xl border-border"
                    inputMode="numeric"
                    autoComplete="postal-code"
                  />
                </div>
              </div>

              {/* CTA */}
              <Button
                type="submit"
                className="h-12 w-full rounded-full bg-accent text-base font-bold text-white shadow-sm hover:bg-accent/90"
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? "Sending…" : "Get My Free Quote"}
              </Button>

              {submitMutation.isError ? (
                <p className="mt-2.5 text-center text-xs text-destructive">
                  Something went wrong. Please try again or call us at (941) 404-7235.
                </p>
              ) : null}

              {/* Dismiss */}
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={handleDismiss}
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
  );
}
