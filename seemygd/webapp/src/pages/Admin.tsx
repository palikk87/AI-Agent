import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "@/lib/api"
import { signOut } from "@/lib/auth"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  LogOut,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Pencil,
  Trash2,
  Plus,
  Shield,
  TrendingUp,
  DollarSign,
  RefreshCw,
  KeyRound,
  Zap,
  Star,
  Gift,
  Link2,
  Copy,
  ExternalLink,
  Globe,
} from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────────────

type AdminStats = {
  totalCompanies: number
  activeCompanies: number
  totalLeads: number
  totalUsers: number
  tierBreakdown: { free?: number; starter: number; growth: number }
}

type AdminCompany = {
  id: string
  businessName: string
  contactEmail: string | null
  contactPhone: string | null
  websiteUrl: string | null
  subscriptionStatus: string
  tierType: string
  customDomain: string | null
  squareCustomerId: string | null
  squareSubscriptionId: string | null
  createdAt: string
  users: {
    id: string
    name: string | null
    email: string
    role?: string
    isAdmin?: boolean
    createdAt?: string
  }[]
  _count: { leads: number }
}

type AdminUser = {
  id: string
  name: string | null
  email: string
  isAdmin: boolean
  createdAt: string
  company: { businessName: string; subscriptionStatus: string } | null
}

type PaymentCard = {
  last4: string
  brand: string
  expMonth: number
  expYear: number
} | null

// ─── Status badge helper ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 gap-1">
        <CheckCircle className="w-3 h-3" /> Active
      </Badge>
    )
  }
  if (status === "past_due") {
    return (
      <Badge className="bg-amber-500/15 text-amber-600 border border-amber-500/30 gap-1">
        <Clock className="w-3 h-3" /> Past Due
      </Badge>
    )
  }
  if (status === "canceled") {
    return (
      <Badge className="bg-destructive/10 text-destructive border border-destructive/30 gap-1">
        <XCircle className="w-3 h-3" /> Canceled
      </Badge>
    )
  }
  return (
    <Badge className="bg-secondary text-muted-foreground gap-1">
      <AlertCircle className="w-3 h-3" /> {status || "Unpaid"}
    </Badge>
  )
}

function TierBadge({ tier }: { tier: string }) {
  if (tier === "free") {
    return (
      <Badge className="bg-violet-500/15 text-violet-600 border border-violet-500/30 gap-1">
        <Gift className="w-3 h-3" /> Free
      </Badge>
    )
  }
  if (tier === "growth") {
    return (
      <Badge className="bg-amber-500/15 text-amber-600 border border-amber-500/30 gap-1">
        <Zap className="w-3 h-3" /> Growth
      </Badge>
    )
  }
  return (
    <Badge className="bg-primary/10 text-primary border border-primary/30 gap-1">
      <Star className="w-3 h-3" /> Starter
    </Badge>
  )
}

// ─── Company Edit Modal ──────────────────────────────────────────────────────

function EditCompanyModal({
  company,
  open,
  onClose,
  onSaved,
}: {
  company: AdminCompany | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    businessName: "",
    contactEmail: "",
    contactPhone: "",
    websiteUrl: "",
    subscriptionStatus: "unpaid",
    tierType: "starter",
    squareCustomerId: "",
    squareSubscriptionId: "",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (company) {
      setForm({
        businessName: company.businessName ?? "",
        contactEmail: company.contactEmail ?? "",
        contactPhone: company.contactPhone ?? "",
        websiteUrl: company.websiteUrl ?? "",
        subscriptionStatus: company.subscriptionStatus ?? "unpaid",
        tierType: company.tierType ?? "starter",
        squareCustomerId: company.squareCustomerId ?? "",
        squareSubscriptionId: company.squareSubscriptionId ?? "",
      })
    }
  }, [company])

  async function handleSave() {
    if (!company) return
    setSaving(true)
    try {
      await api.patch(`/api/admin/companies/${company.id}`, {
        businessName: form.businessName || undefined,
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
        websiteUrl: form.websiteUrl || undefined,
        subscriptionStatus: form.subscriptionStatus,
        tierType: form.tierType,
        squareCustomerId: form.squareCustomerId || undefined,
        squareSubscriptionId: form.squareSubscriptionId || undefined,
      })
      toast.success("Company updated")
      onSaved()
      onClose()
    } catch {
      toast.error("Failed to update company")
    } finally {
      setSaving(false)
    }
  }

  // Apply a single dropdown change immediately to the company (no separate Save needed).
  async function applyField(key: "tierType" | "subscriptionStatus", value: string) {
    if (!company) return
    const prev = form[key]
    setForm((p) => ({ ...p, [key]: value })) // optimistic
    setSaving(true)
    try {
      await api.patch(`/api/admin/companies/${company.id}`, { [key]: value })
      toast.success(
        key === "tierType" ? `Tier changed to ${value}` : `Status changed to ${value}`
      )
      onSaved()
    } catch {
      setForm((p) => ({ ...p, [key]: prev })) // revert on failure
      toast.error("Failed to apply change")
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Company</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Update company details and subscription settings
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-foreground/80">Business Name</Label>
              <Input {...field("businessName")} className="bg-muted border-border text-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Contact Email</Label>
              <Input {...field("contactEmail")} type="email" className="bg-muted border-border text-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Contact Phone</Label>
              <Input {...field("contactPhone")} className="bg-muted border-border text-foreground" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-foreground/80">Website URL</Label>
              <Input {...field("websiteUrl")} className="bg-muted border-border text-foreground" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Subscription Status</Label>
              <Select
                value={form.subscriptionStatus}
                disabled={saving}
                onValueChange={(v) => applyField("subscriptionStatus", v)}
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border text-foreground z-[100]">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground/80">Tier Type</Label>
              <Select
                value={form.tierType}
                disabled={saving}
                onValueChange={(v) => applyField("tierType", v)}
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-muted border-border text-foreground z-[100]">
                  <SelectItem value="free">Free (admin only)</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground/80 text-xs">Square Customer ID</Label>
              <Input {...field("squareCustomerId")} className="bg-muted border-border text-foreground text-xs font-mono" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-foreground/80 text-xs">Square Subscription ID</Label>
              <Input {...field("squareSubscriptionId")} className="bg-muted border-border text-foreground text-xs font-mono" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border text-foreground/80 hover:bg-muted">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    businessName: "",
    tier: "starter",
    activateNow: false,
  })
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!form.name || !form.email || !form.password) {
      toast.error("Name, email, and password are required")
      return
    }
    if (!form.businessName.trim()) {
      toast.error("Business name is required")
      return
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    setSaving(true)
    try {
      await api.post("/api/admin/create-user", {
        name: form.name,
        email: form.email,
        password: form.password,
        businessName: form.businessName,
        tier: form.tier,
        activateNow: form.activateNow,
      })
      toast.success("Client added successfully")
      onCreated()
      onClose()
      setForm({ name: "", email: "", password: "", businessName: "", tier: "starter", activateNow: false })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add client"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof typeof form) => ({
    value: String(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle>Add Client</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a client company and its first login
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-foreground/80">Full Name</Label>
            <Input {...field("name")} placeholder="John Smith" className="bg-muted border-border text-foreground" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground/80">Email</Label>
            <Input {...field("email")} type="email" placeholder="john@company.com" className="bg-muted border-border text-foreground" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground/80">Password</Label>
            <Input {...field("password")} type="password" placeholder="At least 8 characters" className="bg-muted border-border text-foreground" />
            <p className="text-xs text-muted-foreground">Must be at least 8 characters.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground/80">Business Name</Label>
            <Input {...field("businessName")} placeholder="Acme Garage Doors" className="bg-muted border-border text-foreground" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground/80">Plan Tier</Label>
            <Select value={form.tier} onValueChange={(v) => setForm((p) => ({ ...p, tier: v }))}>
              <SelectTrigger className="bg-muted border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-muted border-border text-foreground">
                <SelectItem value="free">Free — $0/mo (admin only)</SelectItem>
                <SelectItem value="starter">Starter — $49/mo</SelectItem>
                <SelectItem value="growth">Growth — $99/mo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.activateNow}
              onChange={(e) => setForm((p) => ({ ...p, activateNow: e.target.checked }))}
              className="rounded border-border"
            />
            <span className="text-foreground/80 text-sm">Activate subscription immediately</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border text-foreground/80 hover:bg-muted">
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Add Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add Login Modal ──────────────────────────────────────────────────────────

function AddLoginModal({
  company,
  open,
  onClose,
  onCreated,
}: {
  company: AdminCompany | null
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({ name: "", email: "", password: "" })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm({ name: "", email: "", password: "" })
  }, [open])

  async function handleCreate() {
    if (!company) return
    if (!form.name || !form.email || !form.password) {
      toast.error("Name, email, and password are required")
      return
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    setSaving(true)
    try {
      await api.post(`/api/admin/companies/${company.id}/users`, {
        name: form.name,
        email: form.email,
        password: form.password,
      })
      toast.success("Login added")
      onCreated()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add login")
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle>Add Login</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Add a new login for {company?.businessName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-foreground/80">Full Name</Label>
            <Input {...field("name")} placeholder="John Smith" className="bg-muted border-border text-foreground" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground/80">Email</Label>
            <Input {...field("email")} type="email" placeholder="john@company.com" className="bg-muted border-border text-foreground" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground/80">Password</Label>
            <Input {...field("password")} type="password" placeholder="At least 8 characters" className="bg-muted border-border text-foreground" />
            <p className="text-xs text-muted-foreground">Must be at least 8 characters.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border text-foreground/80 hover:bg-muted">
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Add Login
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────

function EditUserModal({
  user,
  open,
  onClose,
  onSaved,
}: {
  user: AdminUser | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({ name: "", email: "", isAdmin: false })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setForm({ name: user.name ?? "", email: user.email, isAdmin: user.isAdmin })
    }
  }, [user])

  async function handleSave() {
    if (!user) return
    setSaving(true)
    try {
      await api.patch(`/api/admin/users/${user.id}`, {
        name: form.name || undefined,
        email: form.email || undefined,
        isAdmin: form.isAdmin,
      })
      toast.success("User updated")
      onSaved()
      onClose()
    } catch {
      toast.error("Failed to update user")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription className="text-muted-foreground">Update user account details</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-foreground/80">Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="bg-muted border-border text-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground/80">Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="bg-muted border-border text-foreground"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isAdmin}
              onChange={(e) => setForm((p) => ({ ...p, isAdmin: e.target.checked }))}
              className="rounded border-border"
            />
            <span className="text-foreground/80 text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Admin access
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border text-foreground/80 hover:bg-muted">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Reset Password Modal ────────────────────────────────────────────────────

function ResetPasswordModal({
  user,
  open,
  onClose,
}: {
  user: AdminUser | null
  open: boolean
  onClose: () => void
}) {
  const [newPassword, setNewPassword] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleReset() {
    if (!user || !newPassword) return
    setSaving(true)
    try {
      await api.post(`/api/admin/users/${user.id}/reset-password`, { newPassword })
      toast.success("Password reset successfully")
      setNewPassword("")
      onClose()
    } catch {
      toast.error("Failed to reset password")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setNewPassword(""); onClose() } }}>
      <DialogContent className="bg-card border-border text-foreground max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-amber-600" />
            Reset Password
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Set a new password for {user?.name || user?.email}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-1.5">
          <Label className="text-foreground/80">New Password</Label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            className="bg-muted border-border text-foreground"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border text-foreground/80 hover:bg-muted">
            Cancel
          </Button>
          <Button onClick={handleReset} disabled={saving || !newPassword} className="bg-amber-500 hover:bg-amber-600">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Reset Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Manual Charge Modal ─────────────────────────────────────────────────────

function ManualChargeModal({
  company,
  open,
  onClose,
}: {
  company: AdminCompany | null
  open: boolean
  onClose: () => void
}) {
  const defaultAmount = company?.tierType === "growth" ? "99" : company?.tierType === "free" ? "0" : "49"
  const [amount, setAmount] = useState(defaultAmount)
  const [note, setNote] = useState("")
  const [charging, setCharging] = useState(false)

  useEffect(() => {
    if (company) setAmount(company.tierType === "growth" ? "99" : company.tierType === "free" ? "0" : "49")
  }, [company])

  async function handleCharge() {
    if (!company) return
    setCharging(true)
    try {
      await api.post("/api/admin/payments/charge", {
        companyId: company.id,
        amount: parseFloat(amount),
        note: note || undefined,
      })
      toast.success(`Charged $${amount} to ${company.businessName}`)
      setNote("")
      onClose()
    } catch {
      toast.error("Charge failed")
    } finally {
      setCharging(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="bg-card border-border text-foreground max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Manual Charge
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Charge {company?.businessName} via Square
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-foreground/80">Amount (USD)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-muted border-border text-foreground pl-7"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-foreground/80">Note (optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Manual subscription charge"
              className="bg-muted border-border text-foreground"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border text-foreground/80 hover:bg-muted">
            Cancel
          </Button>
          <Button onClick={handleCharge} disabled={charging || !amount} className="bg-emerald-600 hover:bg-emerald-700">
            {charging ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Charge ${amount}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

// ─── URL Preview Generator (admin-only) ──────────────────────────────────────
// Turns a prospect's website into a shareable, self-expiring preview link that
// renders the branded visualizer without creating a client account. Sales/demo
// only — clients can neither generate nor see these links.
type PreviewResult = {
  site: string
  url: string
  expires: number
  expiresAt: string
  ttlHours: number
}

function PreviewGeneratorCard() {
  const [site, setSite] = useState("")
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<PreviewResult | null>(null)
  const [copied, setCopied] = useState(false)

  async function generate() {
    const trimmed = site.trim()
    if (!trimmed) {
      toast.error("Enter the client's website first")
      return
    }
    setGenerating(true)
    setCopied(false)
    try {
      const data = await api.post<PreviewResult>("/api/admin/preview-url", { site: trimmed })
      setResult(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate preview")
    } finally {
      setGenerating(false)
    }
  }

  function copy() {
    if (!result) return
    navigator.clipboard.writeText(result.url)
    setCopied(true)
    toast.success("Preview link copied")
    setTimeout(() => setCopied(false), 2000)
  }

  const expiresLabel = result
    ? new Date(result.expiresAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : ""

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          URL Preview Generator
        </CardTitle>
        <p className="text-muted-foreground text-sm mt-1">
          Enter a prospect's website to generate a branded demo link you can share. It pulls their
          business name, logo, colors, and contact info automatically and expires after 48 hours —
          no client account or stored data. For sales use only.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-foreground/80">Client Website URL</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-stretch rounded-lg border border-border bg-muted overflow-hidden focus-within:ring-1 focus-within:ring-primary flex-1">
              <span className="px-3 flex items-center text-muted-foreground border-r border-border">
                <Globe className="w-4 h-4" />
              </span>
              <Input
                value={site}
                onChange={(e) => setSite(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") generate()
                }}
                placeholder="smithgaragedoors.com"
                className="border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
              />
            </div>
            <Button onClick={generate} disabled={generating} className="bg-primary hover:bg-primary/90 shrink-0">
              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
              {generating ? "Generating…" : "Generate Preview"}
            </Button>
          </div>
        </div>

        {result ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
              <code className="flex-1 text-primary text-sm break-all">{result.url}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={copy}
                className="shrink-0 border-border text-foreground/80 hover:bg-secondary"
              >
                {copied ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="shrink-0 border-border text-foreground/80 hover:bg-secondary"
              >
                <a href={result.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
            <p className="text-muted-foreground text-xs flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Expires {expiresLabel} ({result.ttlHours}h). After that the link stops working
              automatically.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function OverviewTab() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<AdminStats>("/api/admin/stats")
      .then(setStats)
      .catch(() => toast.error("Failed to load stats"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight text-foreground">Platform Overview</h1>
        <p className="text-muted-foreground mt-1">Real-time metrics across all tenants</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Companies", value: stats?.totalCompanies ?? 0, icon: Building2, color: "text-primary", bg: "bg-primary/10" },
          { label: "Active Subscribers", value: stats?.activeCompanies ?? 0, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-500/10" },
          { label: "Total Leads", value: stats?.totalLeads ?? 0, icon: TrendingUp, color: "text-violet-600", bg: "bg-violet-500/10" },
          { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-orange-600", bg: "bg-orange-500/10" },
        ].map((stat) => (
          <Card key={stat.label} className="bg-card border-border">
            <CardContent className="p-5">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-3xl font-bold text-foreground">{stat.value}</div>
              <div className="text-muted-foreground text-sm mt-0.5">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <PreviewGeneratorCard />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Plan Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(stats?.tierBreakdown.free ?? 0) > 0 ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-violet-600" />
                  <span className="text-foreground/80">Free</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full"
                      style={{
                        width: stats && stats.totalCompanies > 0
                          ? `${((stats.tierBreakdown.free ?? 0) / stats.totalCompanies) * 100}%`
                          : "0%"
                      }}
                    />
                  </div>
                  <span className="text-foreground font-semibold w-6 text-right">
                    {stats?.tierBreakdown.free ?? 0}
                  </span>
                </div>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-primary" />
                <span className="text-foreground/80">Starter</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{
                      width: stats && stats.totalCompanies > 0
                        ? `${(stats.tierBreakdown.starter / stats.totalCompanies) * 100}%`
                        : "0%"
                    }}
                  />
                </div>
                <span className="text-foreground font-semibold w-6 text-right">
                  {stats?.tierBreakdown.starter ?? 0}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" />
                <span className="text-foreground/80">Growth</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{
                      width: stats && stats.totalCompanies > 0
                        ? `${(stats.tierBreakdown.growth / stats.totalCompanies) * 100}%`
                        : "0%"
                    }}
                  />
                </div>
                <span className="text-foreground font-semibold w-6 text-right">
                  {stats?.tierBreakdown.growth ?? 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-base">Monthly Revenue (est.)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">
              ${((stats?.tierBreakdown.starter ?? 0) * 49 + (stats?.tierBreakdown.growth ?? 0) * 99).toLocaleString()}
            </div>
            <p className="text-muted-foreground text-sm mt-1">Based on active subscribers</p>
            <div className="mt-4 flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Starter</span>
                <span className="text-foreground ml-2">${((stats?.tierBreakdown.starter ?? 0) * 49).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Growth</span>
                <span className="text-foreground ml-2">${((stats?.tierBreakdown.growth ?? 0) * 99).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Companies Tab ────────────────────────────────────────────────────────────

function CompaniesTab() {
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [editCompany, setEditCompany] = useState<AdminCompany | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [activating, setActivating] = useState<string | null>(null)
  const [deactivating, setDeactivating] = useState<string | null>(null)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [addLoginCompany, setAddLoginCompany] = useState<AdminCompany | null>(null)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [resetUser, setResetUser] = useState<AdminUser | null>(null)
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)

  const loadCompanies = useCallback(async () => {
    try {
      const data = await api.get<AdminCompany[]>("/api/admin/companies")
      setCompanies(data)
    } catch {
      toast.error("Failed to load companies")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadCompanies() }, [loadCompanies])

  async function handleActivate(id: string) {
    setActivating(id)
    try {
      await api.post(`/api/admin/activate-company/${id}`)
      toast.success("Company activated")
      loadCompanies()
    } catch {
      toast.error("Failed to activate")
    } finally {
      setActivating(null)
    }
  }

  async function handleDeactivate(id: string) {
    setDeactivating(id)
    try {
      await api.patch(`/api/admin/companies/${id}`, { subscriptionStatus: "canceled" })
      toast.success("Company deactivated")
      loadCompanies()
    } catch {
      toast.error("Failed to deactivate")
    } finally {
      setDeactivating(null)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      await api.delete(`/api/admin/companies/${deleteId}`)
      toast.success("Company deleted")
      setDeleteId(null)
      loadCompanies()
    } catch {
      toast.error("Failed to delete company")
    }
  }

  async function handleDeleteUser() {
    if (!deleteUserId) return
    try {
      await api.delete(`/api/admin/users/${deleteUserId}`)
      toast.success("Login deleted")
      setDeleteUserId(null)
      loadCompanies()
    } catch {
      toast.error("Failed to delete login")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-foreground">Clients</h1>
          <p className="text-muted-foreground mt-1">{companies.length} registered client{companies.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadCompanies}
            className="border-border text-foreground/80 hover:bg-muted"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateUser(true)}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Client
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {companies.map((company) => (
          <Card key={company.id} className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-foreground font-semibold">{company.businessName}</span>
                    <StatusBadge status={company.subscriptionStatus} />
                    <TierBadge tier={company.tierType} />
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
                    {company.contactEmail ? (
                      <span>{company.contactEmail}</span>
                    ) : null}
                    <span>{company._count.leads} leads</span>
                    <span>{company.users.length} user{company.users.length !== 1 ? "s" : ""}</span>
                    <span className="text-muted-foreground/70 text-xs">
                      {new Date(company.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {company.subscriptionStatus !== "active" ? (
                    <Button
                      size="sm"
                      onClick={() => handleActivate(company.id)}
                      disabled={activating === company.id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    >
                      {activating === company.id ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      )}
                      Activate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeactivate(company.id)}
                      disabled={deactivating === company.id}
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
                    >
                      {deactivating === company.id ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <XCircle className="w-3 h-3 mr-1" />
                      )}
                      Deactivate
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditCompany(company)}
                    className="border-border text-foreground/80 hover:bg-muted text-xs"
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteId(company.id)}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Nested logins */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Users className="w-3.5 h-3.5" />
                    Logins ({company.users.length})
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAddLoginCompany(company)}
                    className="border-border text-foreground/80 hover:bg-muted text-xs h-7"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add login
                  </Button>
                </div>

                {company.users.length === 0 ? (
                  <p className="text-sm text-muted-foreground pl-2 py-1">No logins yet.</p>
                ) : (
                  <div className="space-y-1.5 pl-2">
                    {company.users.map((u) => {
                      const adminUser: AdminUser = {
                        id: u.id,
                        name: u.name,
                        email: u.email,
                        isAdmin: u.isAdmin ?? false,
                        createdAt: u.createdAt ?? "",
                        company: {
                          businessName: company.businessName,
                          subscriptionStatus: company.subscriptionStatus,
                        },
                      }
                      return (
                        <div
                          key={u.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg bg-muted/40 px-3 py-2"
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <span className="text-foreground font-semibold text-xs">
                                {(u.name || u.email).charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-foreground text-sm font-medium truncate">
                                  {u.name || "No name"}
                                </span>
                                {u.isAdmin ? (
                                  <Badge className="bg-primary/10 text-primary border border-primary/30 gap-1 text-xs">
                                    <Shield className="w-3 h-3" /> Admin
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="text-muted-foreground text-xs truncate">{u.email}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditUser(adminUser)}
                              className="border-border text-foreground/80 hover:bg-muted text-xs h-7"
                            >
                              <Pencil className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setResetUser(adminUser)}
                              className="border-amber-500/30 text-amber-600 hover:bg-amber-100 text-xs h-7"
                            >
                              <KeyRound className="w-3 h-3 mr-1" />
                              Password
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeleteUserId(u.id)}
                              className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs h-7"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <EditCompanyModal
        company={editCompany}
        open={!!editCompany}
        onClose={() => setEditCompany(null)}
        onSaved={loadCompanies}
      />

      <CreateUserModal
        open={showCreateUser}
        onClose={() => setShowCreateUser(false)}
        onCreated={loadCompanies}
      />

      <AddLoginModal
        company={addLoginCompany}
        open={!!addLoginCompany}
        onClose={() => setAddLoginCompany(null)}
        onCreated={loadCompanies}
      />

      <EditUserModal
        user={editUser}
        open={!!editUser}
        onClose={() => setEditUser(null)}
        onSaved={loadCompanies}
      />

      <ResetPasswordModal
        user={resetUser}
        open={!!resetUser}
        onClose={() => setResetUser(null)}
      />

      <AlertDialog open={!!deleteUserId} onOpenChange={(v) => { if (!v) setDeleteUserId(null) }}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Login</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete this login. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted border-border text-foreground hover:bg-secondary">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete Login
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null) }}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete this company and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted border-border text-foreground hover:bg-secondary">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Payments Tab ────────────────────────────────────────────────────────────

function PaymentsTab() {
  const [companies, setCompanies] = useState<AdminCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [cards, setCards] = useState<Record<string, PaymentCard>>({})
  const [chargeCompany, setChargeCompany] = useState<AdminCompany | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get<AdminCompany[]>("/api/admin/companies")
        const withSquare = data.filter((c) => c.squareCustomerId)
        setCompanies(withSquare)
        // Load cards in parallel
        const cardResults = await Promise.allSettled(
          withSquare.map(async (c) => {
            const card = await api.get<PaymentCard>(`/api/admin/payments/cards/${c.id}`)
            return { id: c.id, card }
          })
        )
        const cardMap: Record<string, PaymentCard> = {}
        for (const result of cardResults) {
          if (result.status === "fulfilled") {
            cardMap[result.value.id] = result.value.card
          }
        }
        setCards(cardMap)
      } catch {
        toast.error("Failed to load payments data")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl tracking-tight text-foreground">Payments</h1>
        <p className="text-muted-foreground mt-1">{companies.length} companies with Square connected</p>
      </div>

      {companies.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <CreditCard className="w-10 h-10 text-muted-foreground/70 mx-auto mb-3" />
            <p className="text-muted-foreground">No companies with Square payment methods on file.</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {companies.map((company) => {
          const card = cards[company.id]
          return (
            <Card key={company.id} className="bg-card border-border">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-foreground font-semibold">{company.businessName}</span>
                      <StatusBadge status={company.subscriptionStatus} />
                      <TierBadge tier={company.tierType} />
                    </div>
                    <div className="mt-2 space-y-1">
                      {company.squareCustomerId ? (
                        <div className="text-xs text-muted-foreground font-mono">
                          Customer: {company.squareCustomerId}
                        </div>
                      ) : null}
                      {company.squareSubscriptionId ? (
                        <div className="text-xs text-muted-foreground font-mono">
                          Subscription: {company.squareSubscriptionId}
                        </div>
                      ) : null}
                      {card ? (
                        <div className="flex items-center gap-2 text-sm text-foreground/80">
                          <CreditCard className="w-4 h-4 text-muted-foreground" />
                          {card.brand} •••• {card.last4} — exp {card.expMonth}/{card.expYear}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No card on file</div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setChargeCompany(company)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                    disabled={!company.squareCustomerId}
                  >
                    <DollarSign className="w-4 h-4 mr-1.5" />
                    Manual Charge
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <ManualChargeModal
        company={chargeCompany}
        open={!!chargeCompany}
        onClose={() => setChargeCompany(null)}
      />
    </div>
  )
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

type AdminTab = "overview" | "companies" | "payments"

export default function Admin() {
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [activeTab, setActiveTab] = useState<AdminTab>("overview")

  useEffect(() => {
    async function checkAdmin() {
      try {
        await api.get("/api/admin/me")
        setIsAdmin(true)
      } catch {
        navigate("/login?redirect=/admin")
      } finally {
        setChecking(false)
      }
    }
    checkAdmin()
  }, [navigate])

  function handleSignOut() {
    signOut()
    navigate("/login")
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (!isAdmin) return null

  const navItems: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "companies", label: "Clients", icon: Building2 },
    { id: "payments", label: "Payments", icon: CreditCard },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-card border-b md:border-b-0 md:border-r border-border flex flex-col">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-primary" />
              <div className="text-lg font-bold text-foreground">Admin Portal</div>
            </div>
            <div className="text-sm text-muted-foreground">DoorViz Pro</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="md:hidden text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>

        <nav className="p-3 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap w-full text-left ${
                activeTab === item.id
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex p-4 mt-auto border-t border-border">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 md:p-8">
          {activeTab === "overview" ? <OverviewTab /> : null}
          {activeTab === "companies" ? <CompaniesTab /> : null}
          {activeTab === "payments" ? <PaymentsTab /> : null}
        </div>
      </div>
    </div>
  )
}
