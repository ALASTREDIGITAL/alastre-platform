export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      agency_members: {
        Row: {
          active: boolean
          agency_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          active?: boolean
          agency_id: string
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          active?: boolean
          agency_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_members_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_items: {
        Row: {
          agency_id: string
          client_id: string
          created_at: string
          decided_at: string | null
          decision_by_email: string | null
          decision_note: string | null
          id: string
          requested_by_email: string
          snapshot: Json
          source_id: string
          source_type: string
          status: string
        }
        Insert: {
          agency_id: string
          client_id: string
          created_at?: string
          decided_at?: string | null
          decision_by_email?: string | null
          decision_note?: string | null
          id?: string
          requested_by_email: string
          snapshot: Json
          source_id: string
          source_type: string
          status?: string
        }
        Update: {
          agency_id?: string
          client_id?: string
          created_at?: string
          decided_at?: string | null
          decision_by_email?: string | null
          decision_note?: string | null
          id?: string
          requested_by_email?: string
          snapshot?: Json
          source_id?: string
          source_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_items_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          agency_id: string
          client_id: string | null
          correlation_id: string
          id: number
          occurred_at: string
          payload: Json
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          agency_id: string
          client_id?: string | null
          correlation_id?: string
          id?: never
          occurred_at?: string
          payload?: Json
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          agency_id?: string
          client_id?: string | null
          correlation_id?: string
          id?: never
          occurred_at?: string
          payload?: Json
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          name: string
          slug: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads_campaign_drafts: {
        Row: {
          agency_id: string
          client_id: string
          configuration: Json
          created_at: string
          created_by_email: string
          daily_budget: number
          id: string
          idempotency_key: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          client_id: string
          configuration?: Json
          created_at?: string
          created_by_email: string
          daily_budget: number
          id?: string
          idempotency_key?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          client_id?: string
          configuration?: Json
          created_at?: string
          created_by_email?: string
          daily_budget?: number
          id?: string
          idempotency_key?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_ads_campaign_drafts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_ads_campaign_drafts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          agency_id: string
          client_id: string | null
          created_at: string
          external_account_id: string | null
          id: string
          last_synced_at: string | null
          platform: string
          secret_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          client_id?: string | null
          created_at?: string
          external_account_id?: string | null
          id?: string
          last_synced_at?: string | null
          platform: string
          secret_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          client_id?: string | null
          created_at?: string
          external_account_id?: string | null
          id?: string
          last_synced_at?: string | null
          platform?: string
          secret_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      product_definitions: {
        Row: {
          agency_id: string
          approved_at: string | null
          approved_by_actor_id: string | null
          client_id: string | null
          controllable_deliverables: Json
          created_at: string
          created_by_actor_id: string | null
          external_results: Json
          icp_description: string
          id: string
          influenciable_indicators: Json
          is_immutable: boolean
          name: string
          slug: string
          status: string
          summary: string
          superseded_by_id: string | null
          target_market: string
          target_objective: string
          transformational_promise: string
          anti_icp_description: string
          updated_at: string
          version: number
        }
        Insert: {
          agency_id: string
          approved_at?: string | null
          approved_by_actor_id?: string | null
          client_id?: string | null
          controllable_deliverables?: Json
          created_at?: string
          created_by_actor_id?: string | null
          external_results?: Json
          icp_description?: string
          id: string
          influenciable_indicators?: Json
          is_immutable?: boolean
          name: string
          slug: string
          status?: string
          summary?: string
          superseded_by_id?: string | null
          target_market?: string
          target_objective?: string
          transformational_promise?: string
          anti_icp_description?: string
          updated_at?: string
          version?: number
        }
        Update: {
          agency_id?: string
          approved_at?: string | null
          approved_by_actor_id?: string | null
          client_id?: string | null
          controllable_deliverables?: Json
          created_at?: string
          created_by_actor_id?: string | null
          external_results?: Json
          icp_description?: string
          id?: string
          influenciable_indicators?: Json
          is_immutable?: boolean
          name?: string
          slug?: string
          status?: string
          summary?: string
          superseded_by_id?: string | null
          target_market?: string
          target_objective?: string
          transformational_promise?: string
          anti_icp_description?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_definitions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_definitions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      product_discovery_sessions: {
        Row: {
          agency_id: string
          answers: Json
          completed_at: string | null
          id: string
          product_definition_id: string
          questions: Json
          round_number: number
          started_at: string
          status: string
        }
        Insert: {
          agency_id: string
          answers?: Json
          completed_at?: string | null
          id: string
          product_definition_id: string
          questions?: Json
          round_number?: number
          started_at?: string
          status?: string
        }
        Update: {
          agency_id?: string
          answers?: Json
          completed_at?: string | null
          id?: string
          product_definition_id?: string
          questions?: Json
          round_number?: number
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_discovery_sessions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_discovery_sessions_product_definition_id_fkey"
            columns: ["product_definition_id"]
            isOneToOne: false
            referencedRelation: "product_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_scope_items: {
        Row: {
          acceptance_criteria: string
          activity_name: string
          agency_id: string
          client_participation_required: boolean
          created_at: string
          default_role: string
          delivery_type: string
          dependencies: Json
          description: string
          estimated_minutes: number
          frequency: string
          id: string
          is_automatable: boolean
          product_definition_id: string
          required_evidence: string
          scope_classification: string
          sort_order: number
        }
        Insert: {
          acceptance_criteria?: string
          activity_name: string
          agency_id: string
          client_participation_required?: boolean
          created_at?: string
          default_role?: string
          delivery_type?: string
          dependencies?: Json
          description?: string
          estimated_minutes?: number
          frequency?: string
          id: string
          is_automatable?: boolean
          product_definition_id: string
          required_evidence?: string
          scope_classification?: string
          sort_order?: number
        }
        Update: {
          acceptance_criteria?: string
          activity_name?: string
          agency_id?: string
          client_participation_required?: boolean
          created_at?: string
          default_role?: string
          delivery_type?: string
          dependencies?: Json
          description?: string
          estimated_minutes?: number
          frequency?: string
          id?: string
          is_automatable?: boolean
          product_definition_id?: string
          required_evidence?: string
          scope_classification?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_scope_items_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_scope_items_product_definition_id_fkey"
            columns: ["product_definition_id"]
            isOneToOne: false
            referencedRelation: "product_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_operational_sops: {
        Row: {
          agency_id: string
          completion_criteria: string
          created_at: string
          errors_and_exceptions: Json
          estimated_minutes: number
          id: string
          name: string
          objective: string
          prerequisites: Json
          product_definition_id: string
          quality_checklist: Json
          required_evidence: string
          responsible_role: string
          scope_item_id: string | null
          steps: Json
          tools_required: Json
          trigger: string
        }
        Insert: {
          agency_id: string
          completion_criteria?: string
          created_at?: string
          errors_and_exceptions?: Json
          estimated_minutes?: number
          id: string
          name: string
          objective?: string
          prerequisites?: Json
          product_definition_id: string
          quality_checklist?: Json
          required_evidence?: string
          responsible_role?: string
          scope_item_id?: string | null
          steps?: Json
          tools_required?: Json
          trigger?: string
        }
        Update: {
          agency_id?: string
          completion_criteria?: string
          created_at?: string
          errors_and_exceptions?: Json
          estimated_minutes?: number
          id?: string
          name?: string
          objective?: string
          prerequisites?: Json
          product_definition_id?: string
          quality_checklist?: Json
          required_evidence?: string
          responsible_role?: string
          scope_item_id?: string | null
          steps?: Json
          tools_required?: Json
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_operational_sops_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_operational_sops_product_definition_id_fkey"
            columns: ["product_definition_id"]
            isOneToOne: false
            referencedRelation: "product_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_raci_assignments: {
        Row: {
          activity_name: string
          agency_id: string
          created_at: string
          id: string
          is_future_role: boolean
          product_definition_id: string
          raci_type: string
          role: string
          scope_item_id: string | null
        }
        Insert: {
          activity_name: string
          agency_id: string
          created_at?: string
          id: string
          is_future_role?: boolean
          product_definition_id: string
          raci_type: string
          role: string
          scope_item_id?: string | null
        }
        Update: {
          activity_name?: string
          agency_id?: string
          created_at?: string
          id?: string
          is_future_role?: boolean
          product_definition_id?: string
          raci_type?: string
          role?: string
          scope_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_raci_assignments_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_raci_assignments_product_definition_id_fkey"
            columns: ["product_definition_id"]
            isOneToOne: false
            referencedRelation: "product_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_viability_checkpoints: {
        Row: {
          agency_id: string
          blocking_gaps: Json
          calculated_at: string
          critical_dependencies: Json
          discovery_completeness_percentage: number
          explanation: string
          id: string
          product_definition_id: string
          result: string
          total_recurring_monthly_hours: number
          total_setup_hours: number
          unvalidated_capacity_flags: Json
          viability_score: number
        }
        Insert: {
          agency_id: string
          blocking_gaps?: Json
          calculated_at?: string
          critical_dependencies?: Json
          discovery_completeness_percentage?: number
          explanation?: string
          id: string
          product_definition_id: string
          result?: string
          total_recurring_monthly_hours?: number
          total_setup_hours?: number
          unvalidated_capacity_flags?: Json
          viability_score?: number
        }
        Update: {
          agency_id?: string
          blocking_gaps?: Json
          calculated_at?: string
          critical_dependencies?: Json
          discovery_completeness_percentage?: number
          explanation?: string
          id?: string
          product_definition_id?: string
          result?: string
          total_recurring_monthly_hours?: number
          total_setup_hours?: number
          unvalidated_capacity_flags?: Json
          viability_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_viability_checkpoints_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_viability_checkpoints_product_definition_id_fkey"
            columns: ["product_definition_id"]
            isOneToOne: false
            referencedRelation: "product_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

