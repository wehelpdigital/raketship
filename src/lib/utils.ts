import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format centavos as Philippine Peso, e.g. 29900 -> "₱299" */
export function formatPeso(centavos: number, opts?: { showDecimals?: boolean }) {
  const pesos = centavos / 100
  const showDecimals = opts?.showDecimals ?? !Number.isInteger(pesos)
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(pesos)
}

/**
 * "1,250.50", "₱350" or "350" -> centavos. Null when it is not a price.
 *
 * Deliberately strict about what follows the decimal point: a third digit is
 * almost always a typo, and rounding it silently changes what someone is
 * charged.
 */
export function parsePeso(input: string): number | null {
  const cleaned = input.replace(/[₱,\s]/g, "")
  if (cleaned.length === 0) return null
  if (!/^\d*(\.\d{0,2})?$/.test(cleaned)) return null
  const pesos = Number(cleaned)
  if (!Number.isFinite(pesos)) return null
  return Math.round(pesos * 100)
}
