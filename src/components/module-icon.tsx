import { createElement } from "react"
import {
  Blocks,
  Boxes,
  CalendarCheck,
  CalendarPlus,
  ChartLine,
  CreditCard,
  GitBranch,
  Mail,
  MessageSquare,
  Package,
  ReceiptText,
  Rocket,
  Sparkles,
  Store,
  Timer,
  Truck,
  UserCheck,
  Users,
  Webhook,
  type LucideIcon,
  type LucideProps,
} from "lucide-react"

/**
 * Icon names stored in `modules.icon` and in the flow element registry are
 * plain strings, so they need resolving to a component at render time.
 * Everything the seed data and the registry can name lives here.
 */
const ICONS: Record<string, LucideIcon> = {
  Blocks,
  Boxes,
  CalendarCheck,
  CalendarPlus,
  ChartLine,
  CreditCard,
  GitBranch,
  Mail,
  MessageSquare,
  Package,
  ReceiptText,
  Rocket,
  Sparkles,
  Store,
  Timer,
  Truck,
  UserCheck,
  Users,
  Webhook,
}

export function resolveIcon(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || Boxes
}

/**
 * Rendered through `createElement` rather than `const Icon = …; <Icon />`,
 * which reads to the linter as constructing a component on every render.
 */
export function ModuleIcon({
  name,
  ...props
}: { name: string | null | undefined } & Omit<LucideProps, "name">) {
  // `name` is omitted above because SVGProps already declares one as `string`,
  // which would narrow ours and reject null.
  return createElement(resolveIcon(name), props)
}
