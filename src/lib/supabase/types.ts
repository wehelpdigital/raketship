/**
 * Hand-maintained mirror of supabase/migrations.
 *
 * Regenerate with the Supabase CLI once you have a project access token:
 *   npx supabase gen types typescript --project-id yssyguyiiriviowjcvqi > src/lib/supabase/types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type SubscriptionStatus = "active" | "past_due" | "cancelled"
export type UserModuleStatus = "active" | "paused"
export type FlowKind = "raket" | "module"

export type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  business_name: string | null
  is_admin: boolean
  onboarded_at: string | null
  created_at: string
  updated_at: string
}

export type PlanRow = {
  id: string
  name: string
  tagline: string | null
  description: string | null
  price_centavos: number
  billing_period: string
  features: string[]
  module_slots: number
  sort_order: number
  is_active: boolean
  created_at: string
}

export type SubscriptionRow = {
  id: string
  user_id: string
  plan_id: string
  status: SubscriptionStatus
  current_period_end: string | null
  created_at: string
  updated_at: string
}

export type ModuleRow = {
  id: string
  name: string
  tagline: string | null
  description: string | null
  icon: string
  category: string
  accent: string
  is_default: boolean
  is_available: boolean
  sort_order: number
  created_at: string
}

export type ModuleTierRow = {
  id: string
  module_id: string
  key: string
  name: string
  description: string | null
  price_centavos: number
  level: number
  features: string[]
  node_types: string[]
  created_at: string
}

export type UserModuleRow = {
  id: string
  user_id: string
  module_id: string
  tier_id: string | null
  status: UserModuleStatus
  activated_at: string
  created_at: string
  updated_at: string
}

export type RaketRow = {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export type FlowRow = {
  id: string
  raket_id: string
  user_id: string
  kind: FlowKind
  module_id: string | null
  parent_node_id: string | null
  name: string
  created_at: string
  updated_at: string
}

export type FlowNodeRow = {
  id: string
  flow_id: string
  user_id: string
  node_key: string
  type: string
  module_id: string | null
  position_x: number
  position_y: number
  data: Record<string, Json>
  created_at: string
  updated_at: string
}

export type FlowEdgeRow = {
  id: string
  flow_id: string
  user_id: string
  edge_key: string
  source_key: string
  target_key: string
  label: string | null
  animated: boolean
  data: Record<string, Json>
  created_at: string
}

type Relationship<
  Column extends string,
  Referenced extends string,
  ReferencedColumn extends string = "id",
> = {
  foreignKeyName: `${string}_${Column}_fkey`
  columns: [Column]
  isOneToOne: false
  referencedRelation: Referenced
  referencedColumns: [ReferencedColumn]
}

/**
 * `Relationships` is what lets PostgREST embeds (`select("*, plan:plans(*)")`)
 * type-resolve. An empty array makes every embedded column infer as
 * SelectQueryError, so foreign keys used by a query must be declared here.
 */
type Table<
  Row,
  Required extends keyof Row,
  Relationships extends readonly unknown[] = [],
> = {
  Row: Row
  Insert: Partial<Row> & Pick<Row, Required>
  Update: Partial<Row>
  Relationships: Relationships
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "id">
      plans: Table<PlanRow, "id" | "name">
      subscriptions: Table<
        SubscriptionRow,
        "user_id" | "plan_id",
        [Relationship<"plan_id", "plans">]
      >
      modules: Table<ModuleRow, "id" | "name">
      module_tiers: Table<
        ModuleTierRow,
        "module_id" | "key" | "name",
        [Relationship<"module_id", "modules">]
      >
      user_modules: Table<
        UserModuleRow,
        "user_id" | "module_id",
        [
          Relationship<"module_id", "modules">,
          Relationship<"tier_id", "module_tiers">,
        ]
      >
      rakets: Table<RaketRow, "user_id">
      flows: Table<
        FlowRow,
        "raket_id" | "user_id" | "kind",
        [
          Relationship<"raket_id", "rakets">,
          Relationship<"module_id", "modules">,
          Relationship<"parent_node_id", "flow_nodes">,
        ]
      >
      flow_nodes: Table<
        FlowNodeRow,
        "flow_id" | "user_id" | "node_key" | "type",
        [
          Relationship<"flow_id", "flows">,
          Relationship<"module_id", "modules">,
        ]
      >
      flow_edges: Table<
        FlowEdgeRow,
        "flow_id" | "user_id" | "edge_key" | "source_key" | "target_key",
        [Relationship<"flow_id", "flows">]
      >
    }
    Views: Record<string, never>
    Functions: {
      ensure_my_workspace: {
        Args: Record<string, never>
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
