import type { BusinessProfileRow } from "@/lib/supabase/types"

/**
 * How much of where a business is, a stranger is allowed to see.
 *
 * Shared rather than owned by whichever component happened to need it first:
 * the header prints the address and the footer prints the directions, and if
 * those two ever disagreed about what "hidden" means, the disagreement would
 * be someone's home address on a public page.
 */

/**
 * The address, cut to what the owner agreed to publish.
 *
 * "hidden" returns nothing at all, and "area" drops the street — a raket run
 * out of a bedroom must be able to record an address without it appearing on a
 * page anyone can open.
 */
export function addressLine(
  business: Pick<
    BusinessProfileRow,
    | "address_visibility"
    | "street_address"
    | "barangay"
    | "city"
    | "province"
  >
): string | null {
  if (business.address_visibility === "hidden") return null

  const parts =
    business.address_visibility === "full"
      ? [business.street_address, business.barangay, business.city, business.province]
      : [business.barangay, business.city, business.province]

  const line = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ")

  return line.length > 0 ? line : null
}

/**
 * The landmark, under the same gate as the address.
 *
 * "Katapat ng Mercury Drug, kulay dilaw na gate" locates a house as precisely
 * as a street number does, so publishing it while the address is hidden would
 * defeat the setting for exactly the person it protects.
 */
export function landmarkLine(
  business: Pick<BusinessProfileRow, "address_visibility" | "landmark">
): string | null {
  if (business.address_visibility === "hidden") return null
  return business.landmark?.trim() || null
}
