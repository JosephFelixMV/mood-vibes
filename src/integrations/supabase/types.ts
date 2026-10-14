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
      ai_requests: {
        Row: {
          created_at: string
          flag_reason: string | null
          flagged: boolean
          id: string
          ip_hash: string
          product_ids: string[] | null
          prompt_hash: string
          prompt_text: string
          result_count: number
        }
        Insert: {
          created_at?: string
          flag_reason?: string | null
          flagged?: boolean
          id?: string
          ip_hash: string
          product_ids?: string[] | null
          prompt_hash: string
          prompt_text: string
          result_count?: number
        }
        Update: {
          created_at?: string
          flag_reason?: string | null
          flagged?: boolean
          id?: string
          ip_hash?: string
          product_ids?: string[] | null
          prompt_hash?: string
          prompt_text?: string
          result_count?: number
        }
        Relationships: []
      }
      blog_post_products: {
        Row: {
          display_order: number | null
          id: string
          placement: string
          post_id: string
          product_id: string
        }
        Insert: {
          display_order?: number | null
          id?: string
          placement?: string
          post_id: string
          product_id: string
        }
        Update: {
          display_order?: number | null
          id?: string
          placement?: string
          post_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_products_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author: string | null
          category: string | null
          content: string | null
          cover_image_url: string | null
          created_at: string | null
          cta_label: string | null
          cta_url: string | null
          has_affiliate_links: boolean | null
          id: string
          is_active: boolean | null
          published_at: string | null
          read_time: string | null
          slug: string
          subtitle: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          vibe_category: string | null
        }
        Insert: {
          author?: string | null
          category?: string | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          cta_label?: string | null
          cta_url?: string | null
          has_affiliate_links?: boolean | null
          id?: string
          is_active?: boolean | null
          published_at?: string | null
          read_time?: string | null
          slug: string
          subtitle?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          vibe_category?: string | null
        }
        Update: {
          author?: string | null
          category?: string | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          cta_label?: string | null
          cta_url?: string | null
          has_affiliate_links?: boolean | null
          id?: string
          is_active?: boolean | null
          published_at?: string | null
          read_time?: string | null
          slug?: string
          subtitle?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          vibe_category?: string | null
        }
        Relationships: []
      }
      brand_lookup: {
        Row: {
          brand: string
          core: string[] | null
          created_at: string
          group_name: string | null
          hint: string | null
          id: string
          match_aliases: string[]
          moods: string[] | null
          source: string | null
          url_match: string
          vibes: string[] | null
        }
        Insert: {
          brand: string
          core?: string[] | null
          created_at?: string
          group_name?: string | null
          hint?: string | null
          id?: string
          match_aliases?: string[]
          moods?: string[] | null
          source?: string | null
          url_match?: string
          vibes?: string[] | null
        }
        Update: {
          brand?: string
          core?: string[] | null
          created_at?: string
          group_name?: string | null
          hint?: string | null
          id?: string
          match_aliases?: string[]
          moods?: string[] | null
          source?: string | null
          url_match?: string
          vibes?: string[] | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          affiliate_url: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          regions: string[]
          updated_at: string
        }
        Insert: {
          affiliate_url: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          regions?: string[]
          updated_at?: string
        }
        Update: {
          affiliate_url?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          regions?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string
          icon_url: string | null
          id: string
          name: string
          parent_slug: string | null
          slug: string
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string
          icon_url?: string | null
          id?: string
          name: string
          parent_slug?: string | null
          slug: string
          type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string
          icon_url?: string | null
          id?: string
          name?: string
          parent_slug?: string | null
          slug?: string
          type?: string
        }
        Relationships: []
      }
      daily_picks: {
        Row: {
          created_at: string
          id: string
          pick_date: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pick_date?: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pick_date?: string
          product_id?: string
        }
        Relationships: []
      }
      keywords: {
        Row: {
          created_at: string
          id: string
          term: string
        }
        Insert: {
          created_at?: string
          id?: string
          term: string
        }
        Update: {
          created_at?: string
          id?: string
          term?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          category_slug: string
          created_at: string
          display_order: number
          is_primary: boolean
          product_id: string
        }
        Insert: {
          category_slug: string
          created_at?: string
          display_order?: number
          is_primary?: boolean
          product_id: string
        }
        Update: {
          category_slug?: string
          created_at?: string
          display_order?: number
          is_primary?: boolean
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_clicks: {
        Row: {
          clicked_at: string
          id: string
          product_id: string
        }
        Insert: {
          clicked_at?: string
          id?: string
          product_id: string
        }
        Update: {
          clicked_at?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_clicks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string
          product_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          product_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_keywords: {
        Row: {
          created_at: string
          id: string
          keyword_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          keyword_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          keyword_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_keywords_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "keywords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_keywords_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_moods: {
        Row: {
          created_at: string
          display_order: number
          is_primary: boolean
          mood_slug: string
          product_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          is_primary?: boolean
          mood_slug: string
          product_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          is_primary?: boolean
          mood_slug?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_moods_mood_slug_fkey"
            columns: ["mood_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "product_moods_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reports: {
        Row: {
          honeypot_triggered: boolean
          id: string
          product_id: string
          reported_at: string
          reporter_fingerprint: string
          turnstile_passed: boolean
        }
        Insert: {
          honeypot_triggered?: boolean
          id?: string
          product_id: string
          reported_at?: string
          reporter_fingerprint: string
          turnstile_passed?: boolean
        }
        Update: {
          honeypot_triggered?: boolean
          id?: string
          product_id?: string
          reported_at?: string
          reporter_fingerprint?: string
          turnstile_passed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_reports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_specifications: {
        Row: {
          created_at: string
          display_order: number
          id: string
          item_detail: string
          product_id: string
          specification: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          item_detail: string
          product_id: string
          specification: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          item_detail?: string
          product_id?: string
          specification?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_specifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_vibes: {
        Row: {
          created_at: string
          display_order: number
          is_primary: boolean
          product_id: string
          vibe_slug: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          is_primary?: boolean
          product_id: string
          vibe_slug: string
        }
        Update: {
          created_at?: string
          display_order?: number
          is_primary?: boolean
          product_id?: string
          vibe_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_vibes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_vibes_vibe_slug_fkey"
            columns: ["vibe_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      products: {
        Row: {
          affiliate_url: string
          check_failure_count: number
          company_name: string | null
          created_at: string
          created_by: string | null
          date_added: string
          description: string | null
          external_id: string | null
          external_url: string | null
          fashion_occasions: string[] | null
          fashion_season: string | null
          fashion_warmth: string | null
          id: string
          image_url: string | null
          is_active: boolean
          last_checked_at: string | null
          last_click_at: string | null
          last_status_code: number | null
          last_verified_at: string | null
          name: string
          page_error: boolean
          page_error_detail: string | null
          price: number
          price_below_msrp: boolean
          regions: string[]
          report_count: number
          slug: string
          source: string
          source_url: string
          status: string
          updated_at: string
          updated_by: string | null
          vendor_id: string | null
          video_url: string | null
        }
        Insert: {
          affiliate_url: string
          check_failure_count?: number
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          date_added?: string
          description?: string | null
          external_id?: string | null
          external_url?: string | null
          fashion_occasions?: string[] | null
          fashion_season?: string | null
          fashion_warmth?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          last_checked_at?: string | null
          last_click_at?: string | null
          last_status_code?: number | null
          last_verified_at?: string | null
          name: string
          page_error?: boolean
          page_error_detail?: string | null
          price: number
          price_below_msrp?: boolean
          regions?: string[]
          report_count?: number
          slug: string
          source?: string
          source_url?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          vendor_id?: string | null
          video_url?: string | null
        }
        Update: {
          affiliate_url?: string
          check_failure_count?: number
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          date_added?: string
          description?: string | null
          external_id?: string | null
          external_url?: string | null
          fashion_occasions?: string[] | null
          fashion_season?: string | null
          fashion_warmth?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          last_checked_at?: string | null
          last_click_at?: string | null
          last_status_code?: number | null
          last_verified_at?: string | null
          name?: string
          page_error?: boolean
          page_error_detail?: string | null
          price?: number
          price_below_msrp?: boolean
          regions?: string[]
          report_count?: number
          slug?: string
          source?: string
          source_url?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          vendor_id?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      products_snapshot_phase1: {
        Row: {
          affiliate_url: string | null
          category: string | null
          check_failure_count: number | null
          company_name: string | null
          created_at: string | null
          created_by: string | null
          date_added: string | null
          description: string | null
          fashion_occasions: string[] | null
          fashion_season: string | null
          fashion_warmth: string | null
          id: string | null
          image_url: string | null
          is_active: boolean | null
          last_checked_at: string | null
          last_click_at: string | null
          last_status_code: number | null
          last_verified_at: string | null
          mood: string | null
          name: string | null
          page_error: boolean | null
          page_error_detail: string | null
          price: number | null
          price_below_msrp: boolean | null
          regions: string[] | null
          report_count: number | null
          slug: string | null
          source_url: string | null
          status: string | null
          updated_at: string | null
          updated_by: string | null
          vendor_id: string | null
          vibe_category: string | null
          video_url: string | null
        }
        Insert: {
          affiliate_url?: string | null
          category?: string | null
          check_failure_count?: number | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          date_added?: string | null
          description?: string | null
          fashion_occasions?: string[] | null
          fashion_season?: string | null
          fashion_warmth?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          last_checked_at?: string | null
          last_click_at?: string | null
          last_status_code?: number | null
          last_verified_at?: string | null
          mood?: string | null
          name?: string | null
          page_error?: boolean | null
          page_error_detail?: string | null
          price?: number | null
          price_below_msrp?: boolean | null
          regions?: string[] | null
          report_count?: number | null
          slug?: string | null
          source_url?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vendor_id?: string | null
          vibe_category?: string | null
          video_url?: string | null
        }
        Update: {
          affiliate_url?: string | null
          category?: string | null
          check_failure_count?: number | null
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          date_added?: string | null
          description?: string | null
          fashion_occasions?: string[] | null
          fashion_season?: string | null
          fashion_warmth?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          last_checked_at?: string | null
          last_click_at?: string | null
          last_status_code?: number | null
          last_verified_at?: string | null
          mood?: string | null
          name?: string | null
          page_error?: boolean | null
          page_error_detail?: string | null
          price?: number | null
          price_below_msrp?: boolean | null
          regions?: string[] | null
          report_count?: number | null
          slug?: string | null
          source_url?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          vendor_id?: string | null
          vibe_category?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      site_config: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label?: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      disable_cron_job: { Args: never; Returns: undefined }
      enable_cron_job: { Args: never; Returns: undefined }
      get_categories_with_counts: {
        Args: { category_type?: string }
        Returns: {
          description: string
          icon: string
          icon_url: string
          id: string
          name: string
          parent_slug: string
          product_count: number
          slug: string
          type: string
        }[]
      }
      get_cron_job_status: { Args: never; Returns: boolean }
      get_or_create_daily_pick: { Args: never; Returns: string }
      get_sitemap_combo_counts: {
        Args: never
        Returns: {
          cnt: number
          mood_slug: string
          primary_slug: string
          primary_type: string
        }[]
      }
      has_role: { Args: { _role: string }; Returns: boolean }
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
