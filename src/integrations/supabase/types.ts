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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      token_conditions: {
        Row: {
          id: string
          session_id: string
          token_id: string
          condition_name: string
          duration: number | null
          description: string
          icon: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          token_id: string
          condition_name: string
          duration?: number | null
          description: string
          icon: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          token_id?: string
          condition_name?: string
          duration?: number | null
          description?: string
          icon?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_conditions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_conditions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "board_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      token_health_logs: {
        Row: {
          id: string
          session_id: string
          token_id: string
          player_id: string
          player_name: string
          action_type: string
          amount: number
          hp_before: number
          hp_after: number
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          token_id: string
          player_id: string
          player_name: string
          action_type: string
          amount: number
          hp_before: number
          hp_after: number
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          token_id?: string
          player_id?: string
          player_name?: string
          action_type?: string
          amount?: number
          hp_before?: number
          hp_after?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_health_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_health_logs_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "board_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_health_logs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      initiative_tracker: {
        Row: {
          id: string
          session_id: string
          token_id: string | null
          name: string
          initiative: number
          is_active: boolean
          hp_current: number | null
          hp_max: number | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          token_id?: string | null
          name: string
          initiative: number
          is_active?: boolean
          hp_current?: number | null
          hp_max?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          token_id?: string | null
          name?: string
          initiative?: number
          is_active?: boolean
          hp_current?: number | null
          hp_max?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "initiative_tracker_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      character_sheets: {
        Row: {
          id: string
          session_id: string
          player_id: string
          data: Json
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          player_id: string
          data?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          player_id?: string
          data?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_sheets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_sheets_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      board_drawings: {
        Row: {
          created_at: string
          data: Json
          id: string
          player_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          player_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          player_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_drawings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_drawings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      board_tokens: {
        Row: {
          created_at: string
          height: number
          id: string
          image_url: string
          label: string
          owner_id: string | null
          session_id: string
          token_type: string
          width: number
          x: number
          y: number
          hp_current: number | null
          hp_max: number | null
          pe_current: number | null
          pe_max: number | null
          ps_current: number | null
          ps_max: number | null
          is_hidden: boolean
          vision_radius: number
        }
        Insert: {
          created_at?: string
          height?: number
          id?: string
          image_url: string
          label?: string
          owner_id?: string | null
          session_id: string
          token_type: string
          width?: number
          x?: number
          y?: number
          hp_current?: number | null
          hp_max?: number | null
          pe_current?: number | null
          pe_max?: number | null
          ps_current?: number | null
          ps_max?: number | null
          is_hidden?: boolean
          vision_radius?: number
        }
        Update: {
          created_at?: string
          height?: number
          id?: string
          image_url?: string
          label?: string
          owner_id?: string | null
          session_id?: string
          token_type?: string
          width?: number
          x?: number
          y?: number
          hp_current?: number | null
          hp_max?: number | null
          pe_current?: number | null
          pe_max?: number | null
          ps_current?: number | null
          ps_max?: number | null
          is_hidden?: boolean
          vision_radius?: number
        }
        Relationships: [
          {
            foreignKeyName: "board_tokens_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_tokens_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dice_rolls: {
        Row: {
          created_at: string
          dice_formula: string
          id: string
          is_hidden: boolean
          modifier: number
          player_avatar: string | null
          player_id: string
          player_name: string
          results: number[]
          session_id: string
          total: number
        }
        Insert: {
          created_at?: string
          dice_formula: string
          id?: string
          is_hidden?: boolean
          modifier?: number
          player_avatar?: string | null
          player_id: string
          player_name: string
          results: number[]
          session_id: string
          total: number
        }
        Update: {
          created_at?: string
          dice_formula?: string
          id?: string
          is_hidden?: boolean
          modifier?: number
          player_avatar?: string | null
          player_id?: string
          player_name?: string
          results?: number[]
          session_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "dice_rolls_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_rolls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          password_hash: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name: string
          password_hash: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          password_hash?: string
        }
        Relationships: []
      }
      session_messages: {
        Row: {
          id: string
          session_id: string
          player_id: string
          player_name: string
          player_avatar: string | null
          content: string
          is_whisper: boolean
          whisper_to_player_id: string | null
          whisper_to_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          player_id: string
          player_name: string
          player_avatar?: string | null
          content: string
          is_whisper?: boolean
          whisper_to_player_id?: string | null
          whisper_to_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          player_id?: string
          player_name?: string
          player_avatar?: string | null
          content?: string
          is_whisper?: boolean
          whisper_to_player_id?: string | null
          whisper_to_name?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_messages_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          id: string
          joined_at: string
          player_id: string
          role: string
          session_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          player_id: string
          role: string
          session_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          player_id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          active_map_url: string | null
          created_at: string
          dm_id: string
          grid_size: number
          id: string
          is_active: boolean
          maps: string[] | null
          monster_images: string[] | null
          name: string
          password: string
          show_grid: boolean
          system: string
          combat_round: number
          fog_enabled: boolean
          default_vision_radius: number
        }
        Insert: {
          active_map_url?: string | null
          created_at?: string
          dm_id: string
          grid_size?: number
          id?: string
          is_active?: boolean
          maps?: string[] | null
          monster_images?: string[] | null
          name: string
          password: string
          show_grid?: boolean
          system?: string
          combat_round?: number
          fog_enabled?: boolean
          default_vision_radius?: number
        }
        Update: {
          active_map_url?: string | null
          created_at?: string
          dm_id?: string
          grid_size?: number
          id?: string
          is_active?: boolean
          maps?: string[] | null
          monster_images?: string[] | null
          name?: string
          password?: string
          show_grid?: boolean
          system?: string
          combat_round?: number
          fog_enabled?: boolean
          default_vision_radius?: number
        }
        Relationships: [
          {
            foreignKeyName: "sessions_dm_id_fkey"
            columns: ["dm_id"]
            isOneToOne: false
            referencedRelation: "players"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
