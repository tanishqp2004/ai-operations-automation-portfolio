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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          booking_reference: string
          booking_source: string
          business_id: string
          created_at: string
          customer_id: string
          ends_at: string
          id: string
          idempotency_key: string | null
          notes: string | null
          resource_key: string
          service_id: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          booking_reference: string
          booking_source?: string
          business_id: string
          created_at?: string
          customer_id: string
          ends_at: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          resource_key?: string
          service_id: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          booking_reference?: string
          booking_source?: string
          business_id?: string
          created_at?: string
          customer_id?: string
          ends_at?: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          resource_key?: string
          service_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_business_id_fkey"
            columns: ["customer_id", "business_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "business_id"]
          },
          {
            foreignKeyName: "appointments_service_id_business_id_fkey"
            columns: ["service_id", "business_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          business_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          business_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          business_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          business_id: string
          closes_at: string | null
          day_of_week: number
          id: string
          is_closed: boolean
          opens_at: string | null
        }
        Insert: {
          business_id: string
          closes_at?: string | null
          day_of_week: number
          id?: string
          is_closed?: boolean
          opens_at?: string | null
        }
        Update: {
          business_id?: string
          closes_at?: string | null
          day_of_week?: number
          id?: string
          is_closed?: boolean
          opens_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_integrations: {
        Row: {
          business_id: string
          config: Json
          created_at: string
          external_account_id: string | null
          external_assistant_id: string | null
          id: string
          provider: string
          secret_reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          config?: Json
          created_at?: string
          external_account_id?: string | null
          external_assistant_id?: string | null
          id?: string
          provider: string
          secret_reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          config?: Json
          created_at?: string
          external_account_id?: string | null
          external_assistant_id?: string | null
          id?: string
          provider?: string
          secret_reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_memberships: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_memberships_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notification_email: string | null
          phone: string | null
          plan_tier: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notification_email?: string | null
          phone?: string | null
          plan_tier?: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notification_email?: string | null
          phone?: string | null
          plan_tier?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          business_id: string
          call_ended_at: string | null
          call_started_at: string
          caller_phone: string | null
          customer_id: string | null
          external_call_id: string | null
          id: string
          intent: string | null
          metadata: Json
          outcome: string | null
          summary: string | null
        }
        Insert: {
          business_id: string
          call_ended_at?: string | null
          call_started_at?: string
          caller_phone?: string | null
          customer_id?: string | null
          external_call_id?: string | null
          id?: string
          intent?: string | null
          metadata?: Json
          outcome?: string | null
          summary?: string | null
        }
        Update: {
          business_id?: string
          call_ended_at?: string | null
          call_started_at?: string
          caller_phone?: string | null
          customer_id?: string | null
          external_call_id?: string | null
          id?: string
          intent?: string | null
          metadata?: Json
          outcome?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_customer_id_business_id_fkey"
            columns: ["customer_id", "business_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "business_id"]
          },
        ]
      }
      customers: {
        Row: {
          business_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string
        }
        Insert: {
          business_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone: string
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          appointment_id: string | null
          attempt_count: number
          business_id: string
          channel: string
          created_at: string
          event_type: string
          id: string
          idempotency_key: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          provider_message_id: string | null
          recipient_email: string
          recipient_type: string
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          attempt_count?: number
          business_id: string
          channel?: string
          created_at?: string
          event_type: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          provider_message_id?: string | null
          recipient_email: string
          recipient_type: string
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          attempt_count?: number
          business_id?: string
          channel?: string
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          provider_message_id?: string | null
          recipient_email?: string
          recipient_type?: string
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_outbox_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price: number | null
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          price?: number | null
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_booking: {
        Args: { p_appointment_id: string; p_business_id: string }
        Returns: Json
      }
      claim_email_notifications: {
        Args: { p_limit?: number }
        Returns: {
          appointment_id: string | null
          attempt_count: number
          business_id: string
          channel: string
          created_at: string
          event_type: string
          id: string
          idempotency_key: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          provider_message_id: string | null
          recipient_email: string
          recipient_type: string
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notification_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_booking: {
        Args: {
          p_booking_source?: string
          p_business_id: string
          p_customer_email?: string
          p_customer_name: string
          p_customer_phone: string
          p_idempotency_key?: string
          p_notes?: string
          p_resource_key?: string
          p_service_id: string
          p_starts_at: string
        }
        Returns: Json
      }
      create_business_for_current_user: {
        Args: { p_name: string; p_slug: string; p_timezone?: string }
        Returns: Json
      }
      get_available_slots: {
        Args: {
          p_business_id: string
          p_local_date: string
          p_resource_key?: string
          p_service_id: string
          p_slot_interval_minutes?: number
        }
        Returns: {
          slot_end: string
          slot_start: string
        }[]
      }
      reschedule_booking: {
        Args: {
          p_appointment_id: string
          p_business_id: string
          p_new_starts_at: string
        }
        Returns: Json
      }
      set_email_notification_result: {
        Args: {
          p_error?: string
          p_notification_id: string
          p_provider_message_id?: string
          p_status: string
        }
        Returns: Json
      }
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
