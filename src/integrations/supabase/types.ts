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
      audit_log: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          detail: string | null
          id: string
          target: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          target?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          target?: string | null
        }
        Relationships: []
      }
      clip_files: {
        Row: {
          clip_id: string
          created_at: string
          id: string
          mime: string
          name: string
          path: string
          position: number
          size: number
        }
        Insert: {
          clip_id: string
          created_at?: string
          id?: string
          mime?: string
          name: string
          path: string
          position?: number
          size?: number
        }
        Update: {
          clip_id?: string
          created_at?: string
          id?: string
          mime?: string
          name?: string
          path?: string
          position?: number
          size?: number
        }
        Relationships: [
          {
            foreignKeyName: "clip_files_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "clips"
            referencedColumns: ["id"]
          },
        ]
      }
      clips: {
        Row: {
          burn_after_read: boolean
          code: string
          content: string | null
          created_at: string
          delete_token: string | null
          expired_at: string | null
          expires_at: string
          failed_pin_attempts: number
          file_mime: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          last_accessed_at: string | null
          locked_until: string | null
          notified_at: string | null
          notify_token: string | null
          notify_url: string | null
          pin_hash: string | null
          pin_protected: boolean
          status: string
          type: string
          view_count: number
          viewed_at: string | null
        }
        Insert: {
          burn_after_read?: boolean
          code: string
          content?: string | null
          created_at?: string
          delete_token?: string | null
          expired_at?: string | null
          expires_at: string
          failed_pin_attempts?: number
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          last_accessed_at?: string | null
          locked_until?: string | null
          notified_at?: string | null
          notify_token?: string | null
          notify_url?: string | null
          pin_hash?: string | null
          pin_protected?: boolean
          status?: string
          type: string
          view_count?: number
          viewed_at?: string | null
        }
        Update: {
          burn_after_read?: boolean
          code?: string
          content?: string | null
          created_at?: string
          delete_token?: string | null
          expired_at?: string | null
          expires_at?: string
          failed_pin_attempts?: number
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          last_accessed_at?: string | null
          locked_until?: string | null
          notified_at?: string | null
          notify_token?: string | null
          notify_url?: string | null
          pin_hash?: string | null
          pin_protected?: boolean
          status?: string
          type?: string
          view_count?: number
          viewed_at?: string | null
        }
        Relationships: []
      }
      ip_rules: {
        Row: {
          created_at: string
          id: string
          ip: string
          note: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip: string
          note?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string
          note?: string | null
        }
        Relationships: []
      }
      rate_events: {
        Row: {
          action: string
          created_at: string
          id: number
          ip: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          ip: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          ip?: string
        }
        Relationships: []
      }
      rate_limit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          clip_code: string
          created_at: string
          id: string
          reason: string
          status: string
        }
        Insert: {
          clip_code: string
          created_at?: string
          id?: string
          reason: string
          status?: string
        }
        Update: {
          clip_code?: string
          created_at?: string
          id?: string
          reason?: string
          status?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      storage_purge: {
        Row: {
          file_path: string
          id: number
          purge_after: string
        }
        Insert: {
          file_path: string
          id?: number
          purge_after?: string
        }
        Update: {
          file_path?: string
          id?: number
          purge_after?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      expire_clips: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hit_rate_limit: {
        Args: {
          _action: string
          _ip: string
          _max: number
          _window_seconds: number
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
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
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
