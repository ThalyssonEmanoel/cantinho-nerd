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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string
          created_at: string
          display_name: string
          example_seeded: boolean
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string
          created_at?: string
          display_name: string
          example_seeded?: boolean
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string
          created_at?: string
          display_name?: string
          example_seeded?: boolean
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      session_members: {
        Row: {
          joined_at: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_secrets: {
        Row: {
          password: string
          password_hash: string
          session_id: string
        }
        Insert: {
          password: string
          password_hash: string
          session_id: string
        }
        Update: {
          password?: string
          password_hash?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_secrets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          character_template_id: string | null
          created_at: string
          gm_id: string
          id: string
          invite_id: string
          name: string
          settings: Json
          updated_at: string
        }
        Insert: {
          character_template_id?: string | null
          created_at?: string
          gm_id?: string
          id?: string
          invite_id: string
          name: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          character_template_id?: string | null
          created_at?: string
          gm_id?: string
          id?: string
          invite_id?: string
          name?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_character_template_id_fkey"
            columns: ["character_template_id"]
            isOneToOne: false
            referencedRelation: "sheet_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_gm_id_fkey"
            columns: ["gm_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_gm_data: {
        Row: {
          computed: Json
          orphaned: Json
          session_id: string
          sheet_id: string
          updated_at: string
          values: Json
        }
        Insert: {
          computed?: Json
          orphaned?: Json
          session_id: string
          sheet_id: string
          updated_at?: string
          values?: Json
        }
        Update: {
          computed?: Json
          orphaned?: Json
          session_id?: string
          sheet_id?: string
          updated_at?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sheet_gm_data_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheet_gm_data_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: true
            referencedRelation: "sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_template_versions: {
        Row: {
          published_at: string
          schema: Json
          template_id: string
          version: number
        }
        Insert: {
          published_at?: string
          schema: Json
          template_id: string
          version: number
        }
        Update: {
          published_at?: string
          schema?: Json
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sheet_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sheet_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_templates: {
        Row: {
          created_at: string
          draft_schema: Json
          id: string
          kind: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          draft_schema: Json
          id?: string
          kind: string
          name: string
          owner_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          draft_schema?: Json
          id?: string
          kind?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheet_templates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sheets: {
        Row: {
          computed: Json
          created_at: string
          id: string
          kind: string
          owner_id: string
          session_id: string
          summary: Json
          template_id: string
          template_name: string
          template_version: number
          updated_at: string
          values: Json
        }
        Insert: {
          computed?: Json
          created_at?: string
          id?: string
          kind?: string
          owner_id: string
          session_id: string
          summary?: Json
          template_id: string
          template_name?: string
          template_version: number
          updated_at?: string
          values?: Json
        }
        Update: {
          computed?: Json
          created_at?: string
          id?: string
          kind?: string
          owner_id?: string
          session_id?: string
          summary?: Json
          template_id?: string
          template_name?: string
          template_version?: number
          updated_at?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sheets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheets_template_id_template_version_fkey"
            columns: ["template_id", "template_version"]
            isOneToOne: false
            referencedRelation: "sheet_template_versions"
            referencedColumns: ["template_id", "version"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      publish_sheet_template: {
        Args: { p_template_id: string }
        Returns: number
      }
      seed_example_template: {
        Args: { p_name: string; p_schema: Json }
        Returns: string
      }
      create_session: {
        Args: { p_name: string; p_password: string; p_template_id?: string }
        Returns: Json
      }
      set_session_password: {
        Args: { p_password: string; p_session_id: string }
        Returns: undefined
      }
      regenerate_invite: {
        Args: { p_session_id: string }
        Returns: string
      }
      invite_preview: {
        Args: { p_invite_id: string }
        Returns: Json
      }
      join_session: {
        Args: { p_invite_id: string; p_password: string }
        Returns: string
      }
      create_character_sheet: {
        Args: {
          p_computed: Json
          p_gm_computed: Json
          p_gm_values: Json
          p_session_id: string
          p_summary: Json
          p_template_version: number
          p_values: Json
        }
        Returns: string
      }
      patch_sheet: {
        Args: {
          p_changes: Json
          p_computed?: Json
          p_gm_computed?: Json
          p_sheet_id: string
          p_summary?: Json
        }
        Returns: Json
      }
      rewrite_sheet: {
        Args: {
          p_computed: Json
          p_expected_updated_at: string
          p_gm_computed: Json
          p_gm_values: Json
          p_orphaned: Json
          p_sheet_id: string
          p_summary: Json
          p_template_version: number
          p_values: Json
        }
        Returns: string
      }
      is_gm: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      is_member: {
        Args: { p_session_id: string }
        Returns: boolean
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
