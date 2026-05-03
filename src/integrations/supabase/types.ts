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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      brands: {
        Row: {
          country: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          website: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          website?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          website?: string | null
        }
        Relationships: []
      }
      catalog_jobs: {
        Row: {
          errors: Json | null
          finished_at: string | null
          id: string
          job_name: string
          models_added: number
          models_updated: number
          notes: string | null
          started_at: string
          status: string
        }
        Insert: {
          errors?: Json | null
          finished_at?: string | null
          id?: string
          job_name: string
          models_added?: number
          models_updated?: number
          notes?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          errors?: Json | null
          finished_at?: string | null
          id?: string
          job_name?: string
          models_added?: number
          models_updated?: number
          notes?: string | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          review_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          review_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          review_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      field_options: {
        Row: {
          active: boolean | null
          created_at: string
          field_name: string
          id: string
          label: string
          sort_order: number | null
          value: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          field_name: string
          id?: string
          label: string
          sort_order?: number | null
          value: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          field_name?: string
          id?: string
          label?: string
          sort_order?: number | null
          value?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          read: boolean
          review_id: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          read?: boolean
          review_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          read?: boolean
          review_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      model_review_queue: {
        Row: {
          created_at: string
          id: string
          model_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          submitted_brand: string
          submitted_model: string
          web_check_result: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          model_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          submitted_brand: string
          submitted_model: string
          web_check_result?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          model_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          submitted_brand?: string
          submitted_model?: string
          web_check_result?: Json | null
        }
        Relationships: []
      }
      model_summaries: {
        Row: {
          avg_rating: number | null
          id: string
          model_id: string
          review_count: number
          summary: string | null
          top_tags: Json | null
          updated_at: string
        }
        Insert: {
          avg_rating?: number | null
          id?: string
          model_id: string
          review_count?: number
          summary?: string | null
          top_tags?: Json | null
          updated_at?: string
        }
        Update: {
          avg_rating?: number | null
          id?: string
          model_id?: string
          review_count?: number
          summary?: string | null
          top_tags?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      models: {
        Row: {
          brand_id: string
          category: Database["public"]["Enums"]["shoe_category"] | null
          created_at: string
          drop_mm: number | null
          id: string
          image_status: string
          image_url: string | null
          msrp: number | null
          name: string
          pending_review: boolean
          release_year: number | null
          source: string | null
          stack_height_mm: number | null
          verified: boolean
          weight_g: number | null
        }
        Insert: {
          brand_id: string
          category?: Database["public"]["Enums"]["shoe_category"] | null
          created_at?: string
          drop_mm?: number | null
          id?: string
          image_status?: string
          image_url?: string | null
          msrp?: number | null
          name: string
          pending_review?: boolean
          release_year?: number | null
          source?: string | null
          stack_height_mm?: number | null
          verified?: boolean
          weight_g?: number | null
        }
        Update: {
          brand_id?: string
          category?: Database["public"]["Enums"]["shoe_category"] | null
          created_at?: string
          drop_mm?: number | null
          id?: string
          image_status?: string
          image_url?: string | null
          msrp?: number | null
          name?: string
          pending_review?: boolean
          release_year?: number | null
          source?: string | null
          stack_height_mm?: number | null
          verified?: boolean
          weight_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "models_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          comment_id: string | null
          created_at: string
          id: string
          read: boolean
          review_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          comment_id?: string | null
          created_at?: string
          id?: string
          read?: boolean
          review_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          comment_id?: string | null
          created_at?: string
          id?: string
          read?: boolean
          review_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string | null
          foot_size: number | null
          foot_width: Database["public"]["Enums"]["foot_width"] | null
          goals: string[] | null
          height_cm: number | null
          id: string
          phone: string | null
          running_types: string[] | null
          terrains: Database["public"]["Enums"]["terrain_type"][] | null
          updated_at: string
          user_id: string
          username: string | null
          weekly_volume: Database["public"]["Enums"]["weekly_volume"] | null
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          foot_size?: number | null
          foot_width?: Database["public"]["Enums"]["foot_width"] | null
          goals?: string[] | null
          height_cm?: number | null
          id?: string
          phone?: string | null
          running_types?: string[] | null
          terrains?: Database["public"]["Enums"]["terrain_type"][] | null
          updated_at?: string
          user_id: string
          username?: string | null
          weekly_volume?: Database["public"]["Enums"]["weekly_volume"] | null
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          foot_size?: number | null
          foot_width?: Database["public"]["Enums"]["foot_width"] | null
          goals?: string[] | null
          height_cm?: number | null
          id?: string
          phone?: string | null
          running_types?: string[] | null
          terrains?: Database["public"]["Enums"]["terrain_type"][] | null
          updated_at?: string
          user_id?: string
          username?: string | null
          weekly_volume?: Database["public"]["Enums"]["weekly_volume"] | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      review_tags: {
        Row: {
          id: string
          review_id: string
          tag_id: string
        }
        Insert: {
          id?: string
          review_id: string
          tag_id: string
        }
        Update: {
          id?: string
          review_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_tags_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          content: string | null
          created_at: string
          distance_km: number | null
          guest_session_id: string | null
          id: string
          is_guest: boolean | null
          location: string | null
          media_urls: string[] | null
          model_id: string
          rating: number | null
          terrain: Database["public"]["Enums"]["terrain_type"] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          distance_km?: number | null
          guest_session_id?: string | null
          id?: string
          is_guest?: boolean | null
          location?: string | null
          media_urls?: string[] | null
          model_id: string
          rating?: number | null
          terrain?: Database["public"]["Enums"]["terrain_type"] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          distance_km?: number | null
          guest_session_id?: string | null
          id?: string
          is_guest?: boolean | null
          location?: string | null
          media_urls?: string[] | null
          model_id?: string
          rating?: number | null
          terrain?: Database["public"]["Enums"]["terrain_type"] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_reviews: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_reviews_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          label: string
          sort_order: number | null
          type: Database["public"]["Enums"]["tag_type"]
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          label: string
          sort_order?: number | null
          type: Database["public"]["Enums"]["tag_type"]
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          label?: string
          sort_order?: number | null
          type?: Database["public"]["Enums"]["tag_type"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      claim_guest_reviews: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      foot_width: "narrow" | "regular" | "wide"
      shoe_category:
        | "road"
        | "trail"
        | "track"
        | "cross_training"
        | "walking"
        | "racing"
        | "indoor_climbing"
        | "outdoor_climbing"
        | "mountaineering"
        | "hiking"
        | "recovery"
      tag_type: "positive" | "negative"
      terrain_type: "road" | "trail" | "mixed" | "track"
      weekly_volume: "lt_10km" | "10_30km" | "gt_30km"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
      foot_width: ["narrow", "regular", "wide"],
      shoe_category: [
        "road",
        "trail",
        "track",
        "cross_training",
        "walking",
        "racing",
        "indoor_climbing",
        "outdoor_climbing",
        "mountaineering",
        "hiking",
        "recovery",
      ],
      tag_type: ["positive", "negative"],
      terrain_type: ["road", "trail", "mixed", "track"],
      weekly_volume: ["lt_10km", "10_30km", "gt_30km"],
    },
  },
} as const
