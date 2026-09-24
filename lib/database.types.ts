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
      commercial_companies: {
        Row: {
          agency_id: string
          cid: string | null
          city: string | null
          created_at: string
          id: string
          identity_key: string
          maps_url: string | null
          name: string
          notes: string
          observed_profile_quality: string
          phone: string | null
          place_id: string | null
          rating: number | null
          review_count: number | null
          segment: string | null
          state_uf: string | null
          trade_name: string | null
          units_count: number
          updated_at: string
          website: string | null
        }
        Insert: {
          agency_id: string
          cid?: string | null
          city?: string | null
          created_at?: string
          id: string
          identity_key: string
          maps_url?: string | null
          name: string
          notes?: string
          observed_profile_quality?: string
          phone?: string | null
          place_id?: string | null
          rating?: number | null
          review_count?: number | null
          segment?: string | null
          state_uf?: string | null
          trade_name?: string | null
          units_count?: number
          updated_at?: string
          website?: string | null
        }
        Update: {
          agency_id?: string
          cid?: string | null
          city?: string | null
          created_at?: string
          id?: string
          identity_key?: string
          maps_url?: string | null
          name?: string
          notes?: string
          observed_profile_quality?: string
          phone?: string | null
          place_id?: string | null
          rating?: number | null
          review_count?: number | null
          segment?: string | null
          state_uf?: string | null
          trade_name?: string | null
          units_count?: number
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_companies_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      commercial_contacts: {
        Row: {
          agency_id: string
          company_id: string
          created_at: string
          email: string | null
          id: string
          is_decision_maker: boolean
          is_primary: boolean
          name: string
          notes: string
          phone: string | null
          role_title: string
        }
        Insert: {
          agency_id: string
          company_id: string
          created_at?: string
          email?: string | null
          id: string
          is_decision_maker?: boolean
          is_primary?: boolean
          name: string
          notes?: string
          phone?: string | null
          role_title?: string
        }
        Update: {
          agency_id?: string
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_decision_maker?: boolean
          is_primary?: boolean
          name?: string
          notes?: string
          phone?: string | null
          role_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_contacts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_commercial_contacts_company"
            columns: ["agency_id", "company_id"]
            isOneToOne: false
            referencedRelation: "commercial_companies"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      commercial_opportunities: {
        Row: {
          agency_id: string
          blocking_reason: string | null
          closed_at: string | null
          company_id: string
          created_at: string
          estimated_mrr_value: number | null
          estimated_setup_value: number | null
          id: string
          last_activity_at: string
          loss_reason_code: string | null
          loss_reason_details: string | null
          next_action: string
          next_action_deadline: string
          origin: string
          priority: string
          product_definition_id: string | null
          product_version: number
          responsible_actor_id: string
          responsible_name: string
          stage: string
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          blocking_reason?: string | null
          closed_at?: string | null
          company_id: string
          created_at?: string
          estimated_mrr_value?: number | null
          estimated_setup_value?: number | null
          id: string
          last_activity_at?: string
          loss_reason_code?: string | null
          loss_reason_details?: string | null
          next_action: string
          next_action_deadline: string
          origin?: string
          priority?: string
          product_definition_id?: string | null
          product_version?: number
          responsible_actor_id: string
          responsible_name: string
          stage?: string
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          blocking_reason?: string | null
          closed_at?: string | null
          company_id?: string
          created_at?: string
          estimated_mrr_value?: number | null
          estimated_setup_value?: number | null
          id?: string
          last_activity_at?: string
          loss_reason_code?: string | null
          loss_reason_details?: string | null
          next_action?: string
          next_action_deadline?: string
          origin?: string
          priority?: string
          product_definition_id?: string | null
          product_version?: number
          responsible_actor_id?: string
          responsible_name?: string
          stage?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_opportunities_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_commercial_opportunities_company"
            columns: ["agency_id", "company_id"]
            isOneToOne: false
            referencedRelation: "commercial_companies"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      commercial_assessments: {
        Row: {
          agency_id: string
          assessed_at: string
          assessed_by_actor_id: string
          dimensions: Json
          evidences: Json
          explanation: string
          fit_score: number | null
          gaps: Json
          hypotheses: Json
          id: string
          intent_score: number | null
          opportunity_id: string
          opportunity_score: number | null
          priority_result: string | null
          qualification_result: string | null
          type: string
        }
        Insert: {
          agency_id: string
          assessed_at?: string
          assessed_by_actor_id: string
          dimensions?: Json
          evidences?: Json
          explanation?: string
          fit_score?: number | null
          gaps?: Json
          hypotheses?: Json
          id: string
          intent_score?: number | null
          opportunity_id: string
          opportunity_score?: number | null
          priority_result?: string | null
          qualification_result?: string | null
          type: string
        }
        Update: {
          agency_id?: string
          assessed_at?: string
          assessed_by_actor_id?: string
          dimensions?: Json
          evidences?: Json
          explanation?: string
          fit_score?: number | null
          gaps?: Json
          hypotheses?: Json
          id?: string
          intent_score?: number | null
          opportunity_id?: string
          opportunity_score?: number | null
          priority_result?: string | null
          qualification_result?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_assessments_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_commercial_assessments_opp"
            columns: ["agency_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "commercial_opportunities"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      commercial_diagnoses: {
        Row: {
          agency_id: string
          conducted_at: string
          conducted_by_actor_id: string
          decision: string
          evidences: Json
          expectations: string
          id: string
          next_steps: string
          opportunity_id: string
          red_flags: Json
          risks: Json
          step_answers: Json
        }
        Insert: {
          agency_id: string
          conducted_at?: string
          conducted_by_actor_id: string
          decision?: string
          evidences?: Json
          expectations?: string
          id: string
          next_steps?: string
          opportunity_id: string
          red_flags?: Json
          risks?: Json
          step_answers?: Json
        }
        Update: {
          agency_id?: string
          conducted_at?: string
          conducted_by_actor_id?: string
          decision?: string
          evidences?: Json
          expectations?: string
          id?: string
          next_steps?: string
          opportunity_id?: string
          red_flags?: Json
          risks?: Json
          step_answers?: Json
        }
        Relationships: [
          {
            foreignKeyName: "commercial_diagnoses_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_commercial_diagnoses_opp"
            columns: ["agency_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "commercial_opportunities"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      commercial_proposals: {
        Row: {
          agency_id: string
          created_at: string
          created_by_actor_id: string
          decided_at: string | null
          dependencies: Json
          discount_counterpart: string | null
          discount_justification: string | null
          discount_monthly_percentage: number
          discount_setup_percentage: number
          expectations: Json
          id: string
          is_immutable: boolean
          monthly_price: number
          opportunity_id: string
          payment_terms: string
          product_definition_id: string
          product_version: number
          risks: Json
          scope_adjustments: Json
          selected_scope_items: Json
          sent_at: string | null
          setup_price: number
          status: string
          updated_at: string
          valid_until: string
          version: number
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by_actor_id: string
          decided_at?: string | null
          dependencies?: Json
          discount_counterpart?: string | null
          discount_justification?: string | null
          discount_monthly_percentage?: number
          discount_setup_percentage?: number
          expectations?: Json
          id: string
          is_immutable?: boolean
          monthly_price?: number
          opportunity_id: string
          payment_terms?: string
          product_definition_id: string
          product_version?: number
          risks?: Json
          scope_adjustments?: Json
          selected_scope_items?: Json
          sent_at?: string | null
          setup_price?: number
          status?: string
          updated_at?: string
          valid_until: string
          version?: number
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by_actor_id?: string
          decided_at?: string | null
          dependencies?: Json
          discount_counterpart?: string | null
          discount_justification?: string | null
          discount_monthly_percentage?: number
          discount_setup_percentage?: number
          expectations?: Json
          id?: string
          is_immutable?: boolean
          monthly_price?: number
          opportunity_id?: string
          payment_terms?: string
          product_definition_id?: string
          product_version?: number
          risks?: Json
          scope_adjustments?: Json
          selected_scope_items?: Json
          sent_at?: string | null
          setup_price?: number
          status?: string
          updated_at?: string
          valid_until?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "commercial_proposals_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_commercial_proposals_opp"
            columns: ["agency_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "commercial_opportunities"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      commercial_activities: {
        Row: {
          actor_id: string
          agency_id: string
          cadence: string
          completed_at: string | null
          created_at: string
          deadline: string
          id: string
          notes: string
          objective: string
          opportunity_id: string
          status: string
          title: string
        }
        Insert: {
          actor_id: string
          agency_id: string
          cadence: string
          completed_at?: string | null
          created_at?: string
          deadline: string
          id: string
          notes?: string
          objective: string
          opportunity_id: string
          status?: string
          title: string
        }
        Update: {
          actor_id?: string
          agency_id?: string
          cadence?: string
          completed_at?: string | null
          created_at?: string
          deadline?: string
          id?: string
          notes?: string
          objective?: string
          opportunity_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_activities_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_commercial_activities_opp"
            columns: ["agency_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "commercial_opportunities"
            referencedColumns: ["agency_id", "id"]
          },
        ]
      }
      commercial_sales_handoffs: {
        Row: {
          agency_id: string
          checklist: Json
          client_expectations: string
          company_id: string
          created_at: string
          critical_dependencies: string
          id: string
          missing_data: string
          operational_risks: string
          operations_notes: string | null
          operations_reviewer_actor_id: string | null
          opportunity_id: string
          promises_made: string
          proposal_id: string
          reviewed_at: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          checklist?: Json
          client_expectations?: string
          company_id: string
          created_at?: string
          critical_dependencies?: string
          id: string
          missing_data?: string
          operational_risks?: string
          operations_notes?: string | null
          operations_reviewer_actor_id?: string | null
          opportunity_id: string
          promises_made?: string
          proposal_id: string
          reviewed_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          checklist?: Json
          client_expectations?: string
          company_id?: string
          created_at?: string
          critical_dependencies?: string
          id?: string
          missing_data?: string
          operational_risks?: string
          operations_notes?: string | null
          operations_reviewer_actor_id?: string | null
          opportunity_id?: string
          promises_made?: string
          proposal_id?: string
          reviewed_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_sales_handoffs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_commercial_sales_handoffs_company"
            columns: ["agency_id", "company_id"]
            isOneToOne: false
            referencedRelation: "commercial_companies"
            referencedColumns: ["agency_id", "id"]
          },
          {
            foreignKeyName: "fk_commercial_sales_handoffs_opp"
            columns: ["agency_id", "opportunity_id"]
            isOneToOne: false
            referencedRelation: "commercial_opportunities"
            referencedColumns: ["agency_id", "id"]
          },
          {
            foreignKeyName: "fk_commercial_sales_handoffs_proposal"
            columns: ["agency_id", "proposal_id"]
            isOneToOne: false
            referencedRelation: "commercial_proposals"
            referencedColumns: ["agency_id", "id"]
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

