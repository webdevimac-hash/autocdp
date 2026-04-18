export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          agent_type: string
          campaign_id: string | null
          completed_at: string | null
          created_at: string | null
          dealership_id: string
          duration_ms: number | null
          error: string | null
          id: string
          input_summary: string | null
          input_tokens: number | null
          output_summary: string | null
          output_tokens: number | null
          status: string
        }
        Insert: {
          agent_type: string
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          dealership_id: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          input_summary?: string | null
          input_tokens?: number | null
          output_summary?: string | null
          output_tokens?: number | null
          status?: string
        }
        Update: {
          agent_type?: string
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          dealership_id?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          input_summary?: string | null
          input_tokens?: number | null
          output_summary?: string | null
          output_tokens?: number | null
          status?: string
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          billed_at: string | null
          created_at: string | null
          dealership_id: string
          event_type: string
          id: string
          metadata: Json | null
          quantity: number | null
          unit_cost_cents: number | null
        }
        Insert: {
          billed_at?: string | null
          created_at?: string | null
          dealership_id: string
          event_type: string
          id?: string
          metadata?: Json | null
          quantity?: number | null
          unit_cost_cents?: number | null
        }
        Update: {
          billed_at?: string | null
          created_at?: string | null
          dealership_id?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          quantity?: number | null
          unit_cost_cents?: number | null
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          ai_summary: string | null
          created_at: string
          customer_id: string | null
          dealership_id: string
          direction: string
          duration_seconds: number | null
          from_number: string | null
          id: string
          metadata: Json
          outcome: string | null
          recording_url: string | null
          status: string
          to_number: string | null
          twilio_call_sid: string | null
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string
          customer_id?: string | null
          dealership_id: string
          direction?: string
          duration_seconds?: number | null
          from_number?: string | null
          id?: string
          metadata?: Json
          outcome?: string | null
          recording_url?: string | null
          status?: string
          to_number?: string | null
          twilio_call_sid?: string | null
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          created_at?: string
          customer_id?: string | null
          dealership_id?: string
          direction?: string
          duration_seconds?: number | null
          from_number?: string | null
          id?: string
          metadata?: Json
          outcome?: string | null
          recording_url?: string | null
          status?: string
          to_number?: string | null
          twilio_call_sid?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          ai_instructions: string | null
          channel: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          dealership_id: string
          description: string | null
          id: string
          message_template: string | null
          name: string
          scheduled_at: string | null
          stats: Json | null
          status: string
          target_segment: Json | null
          updated_at: string | null
        }
        Insert: {
          ai_instructions?: string | null
          channel: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          dealership_id: string
          description?: string | null
          id?: string
          message_template?: string | null
          name: string
          scheduled_at?: string | null
          stats?: Json | null
          status?: string
          target_segment?: Json | null
          updated_at?: string | null
        }
        Update: {
          ai_instructions?: string | null
          channel?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          dealership_id?: string
          description?: string | null
          id?: string
          message_template?: string | null
          name?: string
          scheduled_at?: string | null
          stats?: Json | null
          status?: string
          target_segment?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      communications: {
        Row: {
          ai_generated: boolean | null
          campaign_id: string | null
          channel: string
          clicked_at: string | null
          content: string
          created_at: string | null
          customer_id: string
          dealership_id: string
          delivered_at: string | null
          id: string
          opened_at: string | null
          provider_id: string | null
          provider_meta: Json | null
          sent_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          campaign_id?: string | null
          channel: string
          clicked_at?: string | null
          content: string
          created_at?: string | null
          customer_id: string
          dealership_id: string
          delivered_at?: string | null
          id?: string
          opened_at?: string | null
          provider_id?: string | null
          provider_meta?: Json | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          campaign_id?: string | null
          channel?: string
          clicked_at?: string | null
          content?: string
          created_at?: string | null
          customer_id?: string
          dealership_id?: string
          delivered_at?: string | null
          id?: string
          opened_at?: string | null
          provider_id?: string | null
          provider_meta?: Json | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      conquest_leads: {
        Row: {
          address: Json | null
          created_at: string
          dealership_id: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          metadata: Json
          notes: string | null
          phone: string | null
          score: number | null
          source: string | null
          status: string
          updated_at: string
          vehicle_interest: string | null
        }
        Insert: {
          address?: Json | null
          created_at?: string
          dealership_id: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json
          notes?: string | null
          phone?: string | null
          score?: number | null
          source?: string | null
          status?: string
          updated_at?: string
          vehicle_interest?: string | null
        }
        Update: {
          address?: Json | null
          created_at?: string
          dealership_id?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          metadata?: Json
          notes?: string | null
          phone?: string | null
          score?: number | null
          source?: string | null
          status?: string
          updated_at?: string
          vehicle_interest?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: Json | null
          created_at: string | null
          dealership_id: string
          dms_external_id: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          last_visit_date: string | null
          last_visit_embedding: string | null
          lifecycle_stage: string | null
          metadata: Json | null
          phone: string | null
          tags: string[] | null
          total_spend: number | null
          total_visits: number | null
          updated_at: string | null
        }
        Insert: {
          address?: Json | null
          created_at?: string | null
          dealership_id: string
          dms_external_id?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          last_visit_date?: string | null
          last_visit_embedding?: string | null
          lifecycle_stage?: string | null
          metadata?: Json | null
          phone?: string | null
          tags?: string[] | null
          total_spend?: number | null
          total_visits?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: Json | null
          created_at?: string | null
          dealership_id?: string
          dms_external_id?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          last_visit_date?: string | null
          last_visit_embedding?: string | null
          lifecycle_stage?: string | null
          metadata?: Json | null
          phone?: string | null
          tags?: string[] | null
          total_spend?: number | null
          total_visits?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dealerships: {
        Row: {
          address: Json | null
          created_at: string | null
          hours: Json | null
          id: string
          logo_url: string | null
          name: string
          onboarded_at: string | null
          phone: string | null
          settings: Json | null
          slug: string
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          address?: Json | null
          created_at?: string | null
          hours?: Json | null
          id?: string
          logo_url?: string | null
          name: string
          onboarded_at?: string | null
          phone?: string | null
          settings?: Json | null
          slug: string
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          address?: Json | null
          created_at?: string | null
          hours?: Json | null
          id?: string
          logo_url?: string | null
          name?: string
          onboarded_at?: string | null
          phone?: string | null
          settings?: Json | null
          slug?: string
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      dms_connections: {
        Row: {
          created_at: string | null
          dealership_id: string
          encrypted_tokens: string | null
          id: string
          last_error: string | null
          last_sync_at: string | null
          metadata: Json | null
          provider: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dealership_id: string
          encrypted_tokens?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          provider: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dealership_id?: string
          encrypted_tokens?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          provider?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      global_learnings: {
        Row: {
          confidence: number | null
          created_at: string | null
          description: string | null
          id: string
          pattern_data: Json
          pattern_type: string
          region: string | null
          sample_size: number | null
          updated_at: string | null
          vehicle_segment: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          pattern_data: Json
          pattern_type: string
          region?: string | null
          sample_size?: number | null
          updated_at?: string | null
          vehicle_segment?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          pattern_data?: Json
          pattern_type?: string
          region?: string | null
          sample_size?: number | null
          updated_at?: string | null
          vehicle_segment?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          color: string | null
          condition: string | null
          created_at: string
          days_on_lot: number | null
          dealership_id: string
          dms_external_id: string | null
          id: string
          make: string | null
          metadata: Json
          mileage: number | null
          model: string | null
          price: number | null
          status: string
          trim: string | null
          updated_at: string
          vin: string | null
          year: number | null
        }
        Insert: {
          color?: string | null
          condition?: string | null
          created_at?: string
          days_on_lot?: number | null
          dealership_id: string
          dms_external_id?: string | null
          id?: string
          make?: string | null
          metadata?: Json
          mileage?: number | null
          model?: string | null
          price?: number | null
          status?: string
          trim?: string | null
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Update: {
          color?: string | null
          condition?: string | null
          created_at?: string
          days_on_lot?: number | null
          dealership_id?: string
          dms_external_id?: string | null
          id?: string
          make?: string | null
          metadata?: Json
          mileage?: number | null
          model?: string | null
          price?: number | null
          status?: string
          trim?: string | null
          updated_at?: string
          vin?: string | null
          year?: number | null
        }
        Relationships: []
      }
      mail_pieces: {
        Row: {
          campaign_id: string | null
          cost_cents: number | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          dealership_id: string
          delivered_at: string | null
          estimated_delivery: string | null
          first_scanned_at: string | null
          id: string
          is_test: boolean
          last_scanned_at: string | null
          personalized_text: string
          postgrid_mail_id: string | null
          postgrid_order_id: string | null
          postgrid_pdf_url: string | null
          postgrid_status: string | null
          qr_code_url: string | null
          qr_image_data_url: string | null
          scanned_count: number | null
          sent_at: string | null
          status: Database["public"]["Enums"]["mail_piece_status"]
          template_type: Database["public"]["Enums"]["mail_template_type"]
          variables: Json | null
        }
        Insert: {
          campaign_id?: string | null
          cost_cents?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          dealership_id: string
          delivered_at?: string | null
          estimated_delivery?: string | null
          first_scanned_at?: string | null
          id?: string
          is_test?: boolean
          last_scanned_at?: string | null
          personalized_text: string
          postgrid_mail_id?: string | null
          postgrid_order_id?: string | null
          postgrid_pdf_url?: string | null
          postgrid_status?: string | null
          qr_code_url?: string | null
          qr_image_data_url?: string | null
          scanned_count?: number | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["mail_piece_status"]
          template_type: Database["public"]["Enums"]["mail_template_type"]
          variables?: Json | null
        }
        Update: {
          campaign_id?: string | null
          cost_cents?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          dealership_id?: string
          delivered_at?: string | null
          estimated_delivery?: string | null
          first_scanned_at?: string | null
          id?: string
          is_test?: boolean
          last_scanned_at?: string | null
          personalized_text?: string
          postgrid_mail_id?: string | null
          postgrid_order_id?: string | null
          postgrid_pdf_url?: string | null
          postgrid_status?: string | null
          qr_code_url?: string | null
          qr_image_data_url?: string | null
          scanned_count?: number | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["mail_piece_status"]
          template_type?: Database["public"]["Enums"]["mail_template_type"]
          variables?: Json | null
        }
        Relationships: []
      }
      mail_scans: {
        Row: {
          dealership_id: string
          id: string
          ip_address: string | null
          mail_piece_id: string
          referrer: string | null
          scanned_at: string | null
          user_agent: string | null
        }
        Insert: {
          dealership_id: string
          id?: string
          ip_address?: string | null
          mail_piece_id: string
          referrer?: string | null
          scanned_at?: string | null
          user_agent?: string | null
        }
        Update: {
          dealership_id?: string
          id?: string
          ip_address?: string | null
          mail_piece_id?: string
          referrer?: string | null
          scanned_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      sync_jobs: {
        Row: {
          completed_at: string | null
          connection_id: string
          cursor: string | null
          dealership_id: string
          error: string | null
          id: string
          job_type: string
          provider: string
          records_synced: Json | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          connection_id: string
          cursor?: string | null
          dealership_id: string
          error?: string | null
          id?: string
          job_type?: string
          provider: string
          records_synced?: Json | null
          started_at?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          connection_id?: string
          cursor?: string | null
          dealership_id?: string
          error?: string | null
          id?: string
          job_type?: string
          provider?: string
          records_synced?: Json | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          job_id: string
          level: string
          message: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          job_id: string
          level?: string
          message: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          job_id?: string
          level?: string
          message?: string
        }
        Relationships: []
      }
      user_dealerships: {
        Row: {
          created_at: string | null
          dealership_id: string
          id: string
          invited_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dealership_id: string
          id?: string
          invited_by?: string | null
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          dealership_id?: string
          id?: string
          invited_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      visits: {
        Row: {
          created_at: string | null
          customer_id: string
          dealership_id: string
          dms_external_id: string | null
          id: string
          make: string | null
          mileage: number | null
          model: string | null
          ro_number: string | null
          service_notes: string | null
          service_type: string | null
          technician: string | null
          total_amount: number | null
          vin: string | null
          visit_date: string
          year: number | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          dealership_id: string
          dms_external_id?: string | null
          id?: string
          make?: string | null
          mileage?: number | null
          model?: string | null
          ro_number?: string | null
          service_notes?: string | null
          service_type?: string | null
          technician?: string | null
          total_amount?: number | null
          vin?: string | null
          visit_date: string
          year?: number | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          dealership_id?: string
          dms_external_id?: string | null
          id?: string
          make?: string | null
          mileage?: number | null
          model?: string | null
          ro_number?: string | null
          service_notes?: string | null
          service_type?: string | null
          technician?: string | null
          total_amount?: number | null
          vin?: string | null
          visit_date?: string
          year?: number | null
        }
        Relationships: []
      }
      learning_outcomes: {
        Row: {
          campaign_id: string | null
          context: Json
          created_at: string | null
          dealership_id: string
          id: string
          model_version: string | null
          outcome_type: string
          result: Json
        }
        Insert: {
          campaign_id?: string | null
          context: Json
          created_at?: string | null
          dealership_id: string
          id?: string
          model_version?: string | null
          outcome_type: string
          result: Json
        }
        Update: {
          campaign_id?: string | null
          context?: Json
          created_at?: string | null
          dealership_id?: string
          id?: string
          model_version?: string | null
          outcome_type?: string
          result?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_dealership_id: { Args: never; Returns: string }
      auth_dealership_role: { Args: never; Returns: string }
    }
    Enums: {
      mail_piece_status:
        | "pending"
        | "processing"
        | "in_production"
        | "in_transit"
        | "delivered"
        | "returned"
        | "cancelled"
        | "error"
      mail_template_type: "postcard_6x9" | "letter_6x9" | "letter_8.5x11"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]

export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T]
