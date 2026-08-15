import { api } from "./api"

export interface SquareConfig {
  applicationId: string | null
  locationId: string | null
  environment: "sandbox" | "production"
}

// Minimal typings for the parts of the Square Web Payments SDK we use.
interface SquareCard {
  attach: (selector: string | HTMLElement) => Promise<void>
  tokenize: () => Promise<{ status: string; token?: string; errors?: { message: string }[] }>
  destroy: () => Promise<void>
}
interface SquarePayments {
  card: () => Promise<SquareCard>
}
interface SquareSdk {
  payments: (applicationId: string, locationId: string) => SquarePayments
}

declare global {
  interface Window {
    Square?: SquareSdk
  }
}

let configPromise: Promise<SquareConfig> | null = null
export function getSquareConfig(): Promise<SquareConfig> {
  if (!configPromise) {
    configPromise = api.get<SquareConfig>("/api/square/config")
  }
  return configPromise
}

let scriptPromise: Promise<void> | null = null
function loadSquareSdk(environment: "sandbox" | "production"): Promise<void> {
  if (window.Square) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  const src =
    environment === "production"
      ? "https://web.squarecdn.com/v1/square.js"
      : "https://sandbox.web.squarecdn.com/v1/square.js"

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error("Failed to load Square payment library"))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

export type { SquareCard }

/**
 * Loads the Square Web Payments SDK, initializes a card input, and attaches it
 * to the given container element. Returns the card instance so the caller can
 * tokenize() it on submit and destroy() it on unmount.
 */
export async function createSquareCard(container: HTMLElement): Promise<SquareCard> {
  const config = await getSquareConfig()
  if (!config.applicationId || !config.locationId) {
    throw new Error("Payments are not configured. Please contact support.")
  }
  await loadSquareSdk(config.environment)
  if (!window.Square) {
    throw new Error("Square payment library unavailable")
  }
  const payments = window.Square.payments(config.applicationId, config.locationId)
  const card = await payments.card()
  await card.attach(container)
  return card
}
