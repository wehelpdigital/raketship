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
