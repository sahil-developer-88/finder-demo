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
      ledger_entries: {
        Row: {
          id:             string
          user_id:        string
          entry_type:     string
          cash_amount:    number
          barter_amount:  number
          source:         string
          reference_id:   string | null
          description:    string | null
          balance_before: number | null
          balance_after:  number | null
          created_at:     string
        }
        Insert: {
          id?:            string
          user_id:        string
          entry_type:     string
          cash_amount?:   number
          barter_amount?: number
          source:         string
          reference_id?:  string | null
          description?:   string | null
          balance_before?: number | null
          balance_after?:  number | null
          created_at?:    string
        }
        Update: {
          id?:            string
          user_id?:       string
          entry_type?:    string
          cash_amount?:   number
          barter_amount?: number
          source?:        string
          reference_id?:  string | null
          description?:   string | null
          balance_before?: number | null
          balance_after?:  number | null
          created_at?:    string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
      business_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reported_business_id: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reported_business_id: string
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reported_business_id?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_reports_reported_business_id_fkey"
            columns: ["reported_business_id"]
            isOneToOne: false
            referencedRelation: "business_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_reports_reported_business_id_fkey"
            columns: ["reported_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          average_rating: number | null
          barter_percentage: number | null
          business_name: string
          category: string
          contact_method: string
          created_at: string
          description: string
          estimated_value: number | null
          id: string
          images: string[] | null
          location: string
          review_count: number | null
          services_offered: string[]
          status: string
          tax_rate: number
          updated_at: string
          user_id: string
          wanting_in_return: string[]
        }
        Insert: {
          average_rating?: number | null
          barter_percentage?: number | null
          business_name: string
          category: string
          contact_method: string
          created_at?: string
          description: string
          estimated_value?: number | null
          id?: string
          images?: string[] | null
          location: string
          review_count?: number | null
          services_offered?: string[]
          status?: string
          tax_rate?: number
          updated_at?: string
          user_id: string
          wanting_in_return?: string[]
        }
        Update: {
          average_rating?: number | null
          barter_percentage?: number | null
          business_name?: string
          category?: string
          contact_method?: string
          created_at?: string
          description?: string
          estimated_value?: number | null
          id?: string
          images?: string[] | null
          location?: string
          review_count?: number | null
          services_offered?: string[]
          status?: string
          tax_rate?: number
          updated_at?: string
          user_id?: string
          wanting_in_return?: string[]
        }
        Relationships: []
      }
      carts: {
        Row: {
          created_at: string
          id: string
          items: Json
          merchant_info: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          merchant_info?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          merchant_info?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_barcodes: {
        Row: {
          barcode: string
          barcode_type: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          updated_at: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          barcode: string
          barcode_type?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          barcode?: string
          barcode_type?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      dispute_evidence: {
        Row: {
          dispute_id: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          dispute_id: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          dispute_id?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_evidence_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          admin_notes: string | null
          arbitration_outcome: string | null
          created_at: string
          description: string
          dispute_type: string
          evidence_urls: string[]
          id: string
          partial_refund_amount: number | null
          reported_id: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          arbitration_outcome?: string | null
          created_at?: string
          description?: string
          dispute_type?: string
          evidence_urls?: string[]
          id?: string
          partial_refund_amount?: number | null
          reported_id: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          arbitration_outcome?: string | null
          created_at?: string
          description?: string
          dispute_type?: string
          evidence_urls?: string[]
          id?: string
          partial_refund_amount?: number | null
          reported_id?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_credit_profiles: {
        Row: {
          auto_suspend_threshold: number
          created_at: string
          credit_line: number
          flag_reasons: string[]
          flag_status: string
          flagged_at: string | null
          flagged_by: string | null
          id: string
          notes: string | null
          personal_guarantee_on_file: boolean
          risk_score: string
          security_deposit_amount: number
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          auto_suspend_threshold?: number
          created_at?: string
          credit_line?: number
          flag_reasons?: string[]
          flag_status?: string
          flagged_at?: string | null
          flagged_by?: string | null
          id?: string
          notes?: string | null
          personal_guarantee_on_file?: boolean
          risk_score?: string
          security_deposit_amount?: number
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          auto_suspend_threshold?: number
          created_at?: string
          credit_line?: number
          flag_reasons?: string[]
          flag_status?: string
          flagged_at?: string | null
          flagged_by?: string | null
          id?: string
          notes?: string | null
          personal_guarantee_on_file?: boolean
          risk_score?: string
          security_deposit_amount?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      merchant_daily_barter_limits: {
        Row: {
          created_at: string | null
          customer_id: string
          daily_limit: number
          id: string
          last_transaction_at: string | null
          limit_date: string
          merchant_id: string
          remaining_amount: number | null
          transaction_count: number | null
          updated_at: string | null
          used_amount: number | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          daily_limit: number
          id?: string
          last_transaction_at?: string | null
          limit_date?: string
          merchant_id: string
          remaining_amount?: number | null
          transaction_count?: number | null
          updated_at?: string | null
          used_amount?: number | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          daily_limit?: number
          id?: string
          last_transaction_at?: string | null
          limit_date?: string
          merchant_id?: string
          remaining_amount?: number | null
          transaction_count?: number | null
          updated_at?: string | null
          used_amount?: number | null
        }
        Relationships: []
      }
      merchant_pos_settings: {
        Row: {
          created_at: string | null
          daily_barter_limit: number | null
          default_barter_percentage: number | null
          enable_auto_discount: boolean | null
          enable_barcode_scanning: boolean | null
          enable_pos_split_payment: boolean | null
          id: string
          max_barter_amount_per_transaction: number | null
          merchant_id: string
          notify_on_insufficient_credits: boolean | null
          notify_on_payment_failure: boolean | null
          pos_integration_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          daily_barter_limit?: number | null
          default_barter_percentage?: number | null
          enable_auto_discount?: boolean | null
          enable_barcode_scanning?: boolean | null
          enable_pos_split_payment?: boolean | null
          id?: string
          max_barter_amount_per_transaction?: number | null
          merchant_id: string
          notify_on_insufficient_credits?: boolean | null
          notify_on_payment_failure?: boolean | null
          pos_integration_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          daily_barter_limit?: number | null
          default_barter_percentage?: number | null
          enable_auto_discount?: boolean | null
          enable_barcode_scanning?: boolean | null
          enable_pos_split_payment?: boolean | null
          id?: string
          max_barter_amount_per_transaction?: number | null
          merchant_id?: string
          notify_on_insufficient_credits?: boolean | null
          notify_on_payment_failure?: boolean | null
          pos_integration_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_pos_settings_pos_integration_id_fkey"
            columns: ["pos_integration_id"]
            isOneToOne: false
            referencedRelation: "pos_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          listing_id: string | null
          message_type: string
          read: boolean | null
          recipient_id: string
          sender_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          listing_id?: string | null
          message_type?: string
          read?: boolean | null
          recipient_id: string
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          listing_id?: string | null
          message_type?: string
          read?: boolean | null
          recipient_id?: string
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "business_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          provider: string
          state_token: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          provider: string
          state_token: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          state_token?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          category_name: string | null
          created_at: string
          external_product_id: string | null
          external_variant_id: string | null
          id: string
          is_barter_eligible: boolean
          metadata: Json | null
          order_id: string
          product_barcode: string | null
          product_id: string | null
          product_name: string
          product_sku: string | null
          quantity: number
          restriction_reason: string | null
          subtotal: number
          unit_price: number
        }
        Insert: {
          category_name?: string | null
          created_at?: string
          external_product_id?: string | null
          external_variant_id?: string | null
          id?: string
          is_barter_eligible?: boolean
          metadata?: Json | null
          order_id: string
          product_barcode?: string | null
          product_id?: string | null
          product_name: string
          product_sku?: string | null
          quantity?: number
          restriction_reason?: string | null
          subtotal: number
          unit_price: number
        }
        Update: {
          category_name?: string | null
          created_at?: string
          external_product_id?: string | null
          external_variant_id?: string | null
          id?: string
          is_barter_eligible?: boolean
          metadata?: Json | null
          order_id?: string
          product_barcode?: string | null
          product_id?: string | null
          product_name?: string
          product_sku?: string | null
          quantity?: number
          restriction_reason?: string | null
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_for_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_eligibility"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          actual_pickup_time: string | null
          barter_amount: number
          barter_percentage: number
          cancellation_reason: string | null
          cancelled_at: string | null
          cash_amount: number
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          customer_email: string
          customer_id: string
          customer_name: string
          customer_notes: string | null
          customer_phone: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_fee: number
          delivery_state: string | null
          delivery_zip: string | null
          eligible_subtotal: number
          estimated_pickup_time: string | null
          fulfillment_method: string | null
          id: string
          merchant_id: string
          merchant_notes: string | null
          metadata: Json | null
          order_number: string
          payment_method: string | null
          payment_status: string
          pickup_location: string
          pos_draft_order_id: string | null
          pos_integration_id: string | null
          pos_order_id: string | null
          pos_provider: string | null
          restricted_subtotal: number
          service_fee: number
          status: Database["public"]["Enums"]["order_status"]
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          actual_pickup_time?: string | null
          barter_amount?: number
          barter_percentage?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cash_amount?: number
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_email: string
          customer_id: string
          customer_name: string
          customer_notes?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_fee?: number
          delivery_state?: string | null
          delivery_zip?: string | null
          eligible_subtotal?: number
          estimated_pickup_time?: string | null
          fulfillment_method?: string | null
          id?: string
          merchant_id: string
          merchant_notes?: string | null
          metadata?: Json | null
          order_number: string
          payment_method?: string | null
          payment_status?: string
          pickup_location: string
          pos_draft_order_id?: string | null
          pos_integration_id?: string | null
          pos_order_id?: string | null
          pos_provider?: string | null
          restricted_subtotal?: number
          service_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal: number
          tax_amount?: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          actual_pickup_time?: string | null
          barter_amount?: number
          barter_percentage?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cash_amount?: number
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_email?: string
          customer_id?: string
          customer_name?: string
          customer_notes?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_fee?: number
          delivery_state?: string | null
          delivery_zip?: string | null
          eligible_subtotal?: number
          estimated_pickup_time?: string | null
          fulfillment_method?: string | null
          id?: string
          merchant_id?: string
          merchant_notes?: string | null
          metadata?: Json | null
          order_number?: string
          payment_method?: string | null
          payment_status?: string
          pickup_location?: string
          pos_draft_order_id?: string | null
          pos_integration_id?: string | null
          pos_order_id?: string | null
          pos_provider?: string | null
          restricted_subtotal?: number
          service_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_pos_integration_id_fkey"
            columns: ["pos_integration_id"]
            isOneToOne: false
            referencedRelation: "pos_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_requests: {
        Row: {
          buyer_id: string
          created_at: string
          expires_at: string
          id: string
          line_items: Json
          metadata: Json | null
          notes: string | null
          paid_at: string | null
          responded_at: string | null
          seller_id: string
          service_description: string
          status: string
          total_amount: number
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          expires_at?: string
          id?: string
          line_items?: Json
          metadata?: Json | null
          notes?: string | null
          paid_at?: string | null
          responded_at?: string | null
          seller_id: string
          service_description: string
          status?: string
          total_amount: number
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          line_items?: Json
          metadata?: Json | null
          notes?: string | null
          paid_at?: string | null
          responded_at?: string | null
          seller_id?: string
          service_description?: string
          status?: string
          total_amount?: number
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_barcode_scans: {
        Row: {
          barcode_value: string
          created_at: string | null
          customer_id: string
          expires_at: string
          generated_at: string
          id: string
          is_used: boolean | null
          merchant_id: string | null
          pos_integration_id: string | null
          pos_transaction_id: string | null
          scanned_at: string | null
          status: string | null
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          barcode_value: string
          created_at?: string | null
          customer_id: string
          expires_at: string
          generated_at?: string
          id?: string
          is_used?: boolean | null
          merchant_id?: string | null
          pos_integration_id?: string | null
          pos_transaction_id?: string | null
          scanned_at?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          barcode_value?: string
          created_at?: string | null
          customer_id?: string
          expires_at?: string
          generated_at?: string
          id?: string
          is_used?: boolean | null
          merchant_id?: string | null
          pos_integration_id?: string | null
          pos_transaction_id?: string | null
          scanned_at?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_barcode_scans_pos_integration_id_fkey"
            columns: ["pos_integration_id"]
            isOneToOne: false
            referencedRelation: "pos_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_barcode_scans_pos_transaction_id_fkey"
            columns: ["pos_transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_barcode_scans_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_integrations: {
        Row: {
          access_token: string
          access_token_encrypted: string | null
          auth_method: string | null
          config: Json | null
          created_at: string
          encryption_nonce: string | null
          id: string
          last_sync_at: string | null
          merchant_id: string | null
          provider: string
          refresh_token: string | null
          refresh_token_encrypted: string | null
          scopes: string[] | null
          status: string
          store_id: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          access_token_encrypted?: string | null
          auth_method?: string | null
          config?: Json | null
          created_at?: string
          encryption_nonce?: string | null
          id?: string
          last_sync_at?: string | null
          merchant_id?: string | null
          provider: string
          refresh_token?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          status?: string
          store_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          access_token_encrypted?: string | null
          auth_method?: string | null
          config?: Json | null
          created_at?: string
          encryption_nonce?: string | null
          id?: string
          last_sync_at?: string | null
          merchant_id?: string | null
          provider?: string
          refresh_token?: string | null
          refresh_token_encrypted?: string | null
          scopes?: string[] | null
          status?: string
          store_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pos_payment_sessions: {
        Row: {
          barcode_scan_id: string | null
          barter_amount: number | null
          barter_percentage: number | null
          cash_amount: number | null
          completed_at: string | null
          created_at: string | null
          customer_id: string
          error_message: string | null
          expires_at: string
          id: string
          merchant_id: string
          pos_discount_id: string | null
          pos_integration_id: string
          pos_location_id: string | null
          pos_order_id: string | null
          pos_provider: string
          pos_terminal_id: string | null
          rollback_at: string | null
          rollback_reason: string | null
          session_status: string | null
          total_amount: number | null
        }
        Insert: {
          barcode_scan_id?: string | null
          barter_amount?: number | null
          barter_percentage?: number | null
          cash_amount?: number | null
          completed_at?: string | null
          created_at?: string | null
          customer_id: string
          error_message?: string | null
          expires_at?: string
          id?: string
          merchant_id: string
          pos_discount_id?: string | null
          pos_integration_id: string
          pos_location_id?: string | null
          pos_order_id?: string | null
          pos_provider: string
          pos_terminal_id?: string | null
          rollback_at?: string | null
          rollback_reason?: string | null
          session_status?: string | null
          total_amount?: number | null
        }
        Update: {
          barcode_scan_id?: string | null
          barter_amount?: number | null
          barter_percentage?: number | null
          cash_amount?: number | null
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string
          error_message?: string | null
          expires_at?: string
          id?: string
          merchant_id?: string
          pos_discount_id?: string | null
          pos_integration_id?: string
          pos_location_id?: string | null
          pos_order_id?: string | null
          pos_provider?: string
          pos_terminal_id?: string | null
          rollback_at?: string | null
          rollback_reason?: string | null
          session_status?: string | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_payment_sessions_barcode_scan_id_fkey"
            columns: ["barcode_scan_id"]
            isOneToOne: false
            referencedRelation: "pos_barcode_scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payment_sessions_pos_integration_id_fkey"
            columns: ["pos_integration_id"]
            isOneToOne: false
            referencedRelation: "pos_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transactions: {
        Row: {
          barter_amount: number | null
          barter_percentage: number | null
          card_amount: number | null
          cash_amount: number | null
          created_at: string
          currency: string
          customer_info: Json | null
          discount_amount: number | null
          external_transaction_id: string
          id: string
          items: Json | null
          location_id: string | null
          merchant_id: string
          payment_methods: Json | null
          pos_integration_id: string | null
          pos_provider: string
          raw_webhook_data: Json | null
          status: string
          synced_at: string | null
          tax_amount: number | null
          tip_amount: number | null
          total_amount: number
          transaction_date: string
          updated_at: string
          webhook_signature: string | null
        }
        Insert: {
          barter_amount?: number | null
          barter_percentage?: number | null
          card_amount?: number | null
          cash_amount?: number | null
          created_at?: string
          currency?: string
          customer_info?: Json | null
          discount_amount?: number | null
          external_transaction_id: string
          id?: string
          items?: Json | null
          location_id?: string | null
          merchant_id: string
          payment_methods?: Json | null
          pos_integration_id?: string | null
          pos_provider: string
          raw_webhook_data?: Json | null
          status?: string
          synced_at?: string | null
          tax_amount?: number | null
          tip_amount?: number | null
          total_amount: number
          transaction_date: string
          updated_at?: string
          webhook_signature?: string | null
        }
        Update: {
          barter_amount?: number | null
          barter_percentage?: number | null
          card_amount?: number | null
          cash_amount?: number | null
          created_at?: string
          currency?: string
          customer_info?: Json | null
          discount_amount?: number | null
          external_transaction_id?: string
          id?: string
          items?: Json | null
          location_id?: string | null
          merchant_id?: string
          payment_methods?: Json | null
          pos_integration_id?: string | null
          pos_provider?: string
          raw_webhook_data?: Json | null
          status?: string
          synced_at?: string | null
          tax_amount?: number | null
          tip_amount?: number | null
          total_amount?: number
          transaction_date?: string
          updated_at?: string
          webhook_signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pos_transactions_pos_integration_id_fkey"
            columns: ["pos_integration_id"]
            isOneToOne: false
            referencedRelation: "pos_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          barter_enabled: boolean | null
          created_at: string | null
          description: string | null
          id: string
          is_restricted: boolean | null
          name: string
          restriction_reason: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          barter_enabled?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_restricted?: boolean | null
          name: string
          restriction_reason?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          barter_enabled?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_restricted?: boolean | null
          name?: string
          restriction_reason?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_sync_progress: {
        Row: {
          completed_at: string | null
          current_item_name: string | null
          current_step: string | null
          error: string | null
          error_items: number
          id: string
          pos_integration_id: string | null
          processed_items: number
          skipped_items: number
          started_at: string
          status: string
          synced_items: number
          total_items: number
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          current_item_name?: string | null
          current_step?: string | null
          error?: string | null
          error_items?: number
          id?: string
          pos_integration_id?: string | null
          processed_items?: number
          skipped_items?: number
          started_at?: string
          status?: string
          synced_items?: number
          total_items?: number
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          current_item_name?: string | null
          current_step?: string | null
          error?: string | null
          error_items?: number
          id?: string
          pos_integration_id?: string | null
          processed_items?: number
          skipped_items?: number
          started_at?: string
          status?: string
          synced_items?: number
          total_items?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_sync_progress_pos_integration_id_fkey"
            columns: ["pos_integration_id"]
            isOneToOne: false
            referencedRelation: "pos_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          barter_enabled: boolean | null
          business_id: string | null
          category_id: string | null
          cost: number | null
          created_at: string | null
          currency: string | null
          custom_barter_percentage: number | null
          description: string | null
          external_product_id: string
          external_variant_id: string | null
          id: string
          image_url: string | null
          images: Json | null
          is_active: boolean | null
          is_archived: boolean | null
          last_synced_at: string | null
          low_stock_threshold: number | null
          merchant_id: string
          metadata: Json | null
          name: string
          pos_integration_id: string
          price: number
          show_stock_publicly: boolean | null
          sku: string | null
          stock_quantity: number | null
          sync_error: string | null
          sync_status: string | null
          upc: string | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          barter_enabled?: boolean | null
          business_id?: string | null
          category_id?: string | null
          cost?: number | null
          created_at?: string | null
          currency?: string | null
          custom_barter_percentage?: number | null
          description?: string | null
          external_product_id: string
          external_variant_id?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          is_active?: boolean | null
          is_archived?: boolean | null
          last_synced_at?: string | null
          low_stock_threshold?: number | null
          merchant_id: string
          metadata?: Json | null
          name: string
          pos_integration_id: string
          price?: number
          show_stock_publicly?: boolean | null
          sku?: string | null
          stock_quantity?: number | null
          sync_error?: string | null
          sync_status?: string | null
          upc?: string | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          barter_enabled?: boolean | null
          business_id?: string | null
          category_id?: string | null
          cost?: number | null
          created_at?: string | null
          currency?: string | null
          custom_barter_percentage?: number | null
          description?: string | null
          external_product_id?: string
          external_variant_id?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          is_active?: boolean | null
          is_archived?: boolean | null
          last_synced_at?: string | null
          low_stock_threshold?: number | null
          merchant_id?: string
          metadata?: Json | null
          name?: string
          pos_integration_id?: string
          price?: number
          show_stock_publicly?: boolean | null
          sku?: string | null
          stock_quantity?: number | null
          sync_error?: string | null
          sync_status?: string | null
          upc?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "products_pos_integration_id_fkey"
            columns: ["pos_integration_id"]
            isOneToOne: false
            referencedRelation: "pos_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          barter_percentage: number | null
          bio: string | null
          business_name: string | null
          business_type: string | null
          business_verified: boolean | null
          created_at: string
          delivery_address: string | null
          delivery_city: string | null
          delivery_state: string | null
          delivery_zip: string | null
          email: string | null
          fcm_token: string | null
          full_name: string | null
          id: string
          location: string | null
          onboarding_completed: boolean | null
          phone: string | null
          pos_pin: string | null
          pos_setup_preference: string | null
          referral_code: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          barter_percentage?: number | null
          bio?: string | null
          business_name?: string | null
          business_type?: string | null
          business_verified?: boolean | null
          created_at?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_state?: string | null
          delivery_zip?: string | null
          email?: string | null
          fcm_token?: string | null
          full_name?: string | null
          id?: string
          location?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          pos_pin?: string | null
          pos_setup_preference?: string | null
          referral_code?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          barter_percentage?: number | null
          bio?: string | null
          business_name?: string | null
          business_type?: string | null
          business_verified?: boolean | null
          created_at?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_state?: string | null
          delivery_zip?: string | null
          email?: string | null
          fcm_token?: string | null
          full_name?: string | null
          id?: string
          location?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          pos_pin?: string | null
          pos_setup_preference?: string | null
          referral_code?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          id:          string
          user_id:     string
          business_id: string
          created_at:  string
        }
        Insert: {
          id?:         string
          user_id:     string
          business_id: string
          created_at?: string
        }
        Update: {
          id?:         string
          user_id?:    string
          business_id?: string
          created_at?: string
        }
        Relationships: []
      }
      qr_failure_log: {
        Row: {
          created_at: string
          customer_id: string | null
          expired_at: string | null
          failure_code: string
          id: string
          merchant_id: string | null
          scanned_at: string
          seconds_late: number | null
          token: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          expired_at?: string | null
          failure_code: string
          id?: string
          merchant_id?: string | null
          scanned_at?: string
          seconds_late?: number | null
          token: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          expired_at?: string | null
          failure_code?: string
          id?: string
          merchant_id?: string | null
          scanned_at?: string
          seconds_late?: number | null
          token?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          points_awarded: number
          referral_code: string
          referred_id: string
          referrer_id: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          points_awarded?: number
          referral_code: string
          referred_id: string
          referrer_id: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          points_awarded?: number
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          status?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          service_name: string | null
          transaction_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          service_name?: string | null
          transaction_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
          service_name?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_info: {
        Row: {
          account_number: string | null
          address: string
          business_name: string | null
          business_type: string
          certification_agreed: boolean | null
          city: string
          created_at: string
          exempt_from_backup_withholding: boolean | null
          id: string
          legal_name: string
          llc_classification: string | null
          signature: string | null
          signature_date: string | null
          state: string
          tax_id: string
          tax_id_type: string
          updated_at: string
          user_id: string
          zip_code: string
        }
        Insert: {
          account_number?: string | null
          address: string
          business_name?: string | null
          business_type: string
          certification_agreed?: boolean | null
          city: string
          created_at?: string
          exempt_from_backup_withholding?: boolean | null
          id?: string
          legal_name: string
          llc_classification?: string | null
          signature?: string | null
          signature_date?: string | null
          state: string
          tax_id: string
          tax_id_type: string
          updated_at?: string
          user_id: string
          zip_code: string
        }
        Update: {
          account_number?: string | null
          address?: string
          business_name?: string | null
          business_type?: string
          certification_agreed?: boolean | null
          city?: string
          created_at?: string
          exempt_from_backup_withholding?: boolean | null
          id?: string
          legal_name?: string
          llc_classification?: string | null
          signature?: string | null
          signature_date?: string | null
          state?: string
          tax_id?: string
          tax_id_type?: string
          updated_at?: string
          user_id?: string
          zip_code?: string
        }
        Relationships: []
      }
      trade_requests: {
        Row: {
          barter_percentage: number
          business_id: string | null
          created_at: string | null
          id: string
          merchant_id: string
          sender_id: string
          service_name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          barter_percentage: number
          business_id?: string | null
          created_at?: string | null
          id?: string
          merchant_id: string
          sender_id: string
          service_name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          barter_percentage?: number
          business_id?: string | null
          created_at?: string | null
          id?: string
          merchant_id?: string
          sender_id?: string
          service_name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trade_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          points_amount: number
          service_description: string | null
          status: string
          to_user_id: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          points_amount: number
          service_description?: string | null
          status?: string
          to_user_id: string
          transaction_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          points_amount?: number
          service_description?: string | null
          status?: string
          to_user_id?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          available_credits: number
          created_at: string
          earned_credits: number
          id: string
          spent_credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          available_credits?: number
          created_at?: string
          earned_credits?: number
          id?: string
          spent_credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          available_credits?: number
          created_at?: string
          earned_credits?: number
          id?: string
          spent_credits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          payload: Json
          provider: string
          signature: string | null
          status: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          payload: Json
          provider: string
          signature?: string | null
          status: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          payload?: Json
          provider?: string
          signature?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      business_listings: {
        Row: {
          barter_percentage: number | null
          business_name: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string | null
          location: string | null
          services_offered: string[] | null
          status: string | null
          user_id: string | null
          wanting_in_return: string[] | null
        }
        Insert: {
          barter_percentage?: number | null
          business_name?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          location?: string | null
          services_offered?: string[] | null
          status?: string | null
          user_id?: never
          wanting_in_return?: string[] | null
        }
        Update: {
          barter_percentage?: number | null
          business_name?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          location?: string | null
          services_offered?: string[] | null
          status?: string | null
          user_id?: never
          wanting_in_return?: string[] | null
        }
        Relationships: []
      }
      payment_requests_with_details: {
        Row: {
          buyer_business_name: string | null
          buyer_email: string | null
          buyer_full_name: string | null
          buyer_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string | null
          is_expired: boolean | null
          line_items: Json | null
          metadata: Json | null
          notes: string | null
          paid_at: string | null
          responded_at: string | null
          seller_business_name: string | null
          seller_email: string | null
          seller_full_name: string | null
          seller_id: string | null
          service_description: string | null
          status: string | null
          total_amount: number | null
          transaction_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      products_for_customers: {
        Row: {
          barcode: string | null
          barter_enabled: boolean | null
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          merchant_id: string | null
          name: string | null
          price: number | null
          sku: string | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          barter_enabled?: boolean | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          merchant_id?: string | null
          name?: string | null
          price?: number | null
          sku?: string | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          barter_enabled?: boolean | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          merchant_id?: string | null
          name?: string | null
          price?: number | null
          sku?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      products_with_eligibility: {
        Row: {
          barcode: string | null
          barter_enabled: boolean | null
          business_barter_percentage: number | null
          business_id: string | null
          business_location: string | null
          business_name: string | null
          category_id: string | null
          category_is_restricted: boolean | null
          category_name: string | null
          cost: number | null
          created_at: string | null
          currency: string | null
          custom_barter_percentage: number | null
          description: string | null
          effective_barter_percentage: number | null
          external_product_id: string | null
          external_variant_id: string | null
          id: string | null
          image_url: string | null
          images: Json | null
          is_active: boolean | null
          is_archived: boolean | null
          is_barter_eligible: boolean | null
          last_synced_at: string | null
          low_stock_threshold: number | null
          merchant_id: string | null
          metadata: Json | null
          name: string | null
          pos_integration_id: string | null
          pos_provider: string | null
          pos_store_id: string | null
          price: number | null
          reason: string | null
          restriction_reason: string | null
          show_stock_publicly: boolean | null
          sku: string | null
          stock_quantity: number | null
          sync_error: string | null
          sync_status: string | null
          upc: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "products_pos_integration_id_fkey"
            columns: ["pos_integration_id"]
            isOneToOne: false
            referencedRelation: "pos_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      run_fraud_detection: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      admin_write_off_credits: {
        Args: {
          p_target_user_id: string
          p_reason?: string
        }
        Returns: Json
      }
      admin_adjust_credits: {
        Args: {
          p_delta: number
          p_notes?: string
          p_reason: string
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_batch_issue_credits: {
        Args: {
          p_entries: Json
          p_reason: string
          p_notes?: string
        }
        Returns: Json
      }
      admin_issue_refund: {
        Args: {
          p_tx_id: string
          p_tx_type: string
          p_reason?: string
        }
        Returns: Json
      }
      admin_edit_transaction: {
        Args: {
          p_tx_id: string
          p_tx_type: string
          p_fields: Json
        }
        Returns: Json
      }
      authenticate_with_pin: {
        Args: { p_business_name: string; p_pin: string }
        Returns: {
          available_credits: number
          business_name: string
          error_message: string
          full_name: string
          success: boolean
          user_id: string
        }[]
      }
      award_referral_points: {
        Args: { p_referred_user_id: string }
        Returns: undefined
      }
      cancel_pending_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: boolean
      }
      cleanup_expired_qr_tokens: { Args: never; Returns: number }
      complete_pos_payment_session: {
        Args: {
          p_barter_amount: number
          p_pos_order_id: string
          p_session_id: string
          p_total_amount: number
        }
        Returns: {
          error_message: string
          success: boolean
          transaction_id: string
        }[]
      }
      create_pending_order: {
        Args: {
          p_customer_id: string
          p_items: Json[]
          p_merchant_id: string
          p_order_data: Json
        }
        Returns: string
      }
      create_referral_link: {
        Args: { p_referral_code: string; p_referred_user_id: string }
        Returns: undefined
      }
      credit_merchant_balance: {
        Args: { p_amount: number; p_merchant_id: string }
        Returns: undefined
      }
      debit_user_credits: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      expire_old_payment_requests: { Args: never; Returns: undefined }
      expire_old_pos_sessions: { Args: never; Returns: number }
      finalize_order_payment: {
        Args: { p_order_id: string; p_pos_order_id?: string }
        Returns: {
          error_message: string
          success: boolean
        }[]
      }
      generate_customer_barcode: {
        Args: { p_user_id: string }
        Returns: string
      }
      generate_ephemeral_qr_token: {
        Args: { p_ttl_minutes?: number; p_user_id: string }
        Returns: string
      }
      generate_order_number: { Args: never; Returns: string }
      get_product_barter_eligibility: {
        Args: { product_id: string }
        Returns: {
          barter_percentage: number
          is_eligible: boolean
          reason: string
        }[]
      }
      get_public_profile_info: {
        Args: { profile_user_id: string }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      get_user_emails: {
        Args: never
        Returns: {
          email: string
          id: string
        }[]
      }
      initiate_pos_payment_session: {
        Args: {
          p_barcode: string
          p_merchant_id: string
          p_pos_integration_id: string
        }
        Returns: {
          available_credits: number
          barter_percentage: number
          customer_id: string
          customer_name: string
          error_message: string
          session_id: string
          success: boolean
        }[]
      }
      is_product_available: { Args: { p_product_id: string }; Returns: boolean }
      is_product_restricted: { Args: { product_id: string }; Returns: boolean }
      merchant_get_daily_summary: {
        Args: { p_days?: number }
        Returns: {
          barter_amount: number
          cash_amount: number
          summary_date: string
          total_sales: number
          tx_count: number
        }[]
      }
      merchant_get_summary_range: {
        Args: { p_start: string; p_end: string }
        Returns: {
          summary_date: string
          total_sales: number
          barter_amount: number
          cash_amount: number
          tx_count: number
        }[]
      }
      merchant_get_yearly_barter_earnings: {
        Args: { p_year?: number }
        Returns: {
          month_label: string
          month_num: number
          earned: number
          spent: number
        }[]
      }
      process_order_checkout: {
        Args: {
          p_customer_id: string
          p_items: Json[]
          p_merchant_id: string
          p_order_data: Json
        }
        Returns: string
      }
      rollback_pos_payment_session: {
        Args: { p_reason: string; p_session_id: string }
        Returns: boolean
      }
      update_barcode_usage: { Args: { p_barcode: string }; Returns: undefined }
      update_order_from_pos_webhook: {
        Args: {
          p_draft_order_id: string
          p_new_status?: string
          p_pos_order_id: string
        }
        Returns: {
          error_message: string
          order_id: string
          success: boolean
        }[]
      }
      update_order_status: {
        Args: {
          p_merchant_notes?: string
          p_new_status: Database["public"]["Enums"]["order_status"]
          p_order_id: string
        }
        Returns: boolean
      }
      validate_and_consume_qr_token: {
        Args: { p_merchant_id: string; p_token: string }
        Returns: {
          consumed_at: string
          customer_id: string
        }[]
      }
      peek_barter_qr: {
        Args: { p_token: string }
        Returns: {
          customer_id: string
          customer_name: string
          available_credits: number
          valid: boolean
          error_message: string | null
        }[]
      }
      process_barter_payment: {
        Args: { p_token: string; p_merchant_id: string; p_barter_amount: number }
        Returns: {
          success: boolean
          customer_id: string
          customer_name: string
          barter_amount: number
          transaction_id: string
          error_message: string | null
        }[]
      }
      customer_pay_merchant: {
        Args: { p_merchant_id: string; p_amount: number }
        Returns: {
          success: boolean
          merchant_name: string
          amount: number
          transaction_id: string
          error_message: string | null
        }[]
      }
    }
    Enums: {
      order_status:
        | "pending_payment"
        | "payment_failed"
        | "confirmed"
        | "pending_pos_payment"
        | "preparing"
        | "ready_for_pickup"
        | "completed"
        | "cancelled"
        | "refunded"
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
      order_status: [
        "pending_payment",
        "payment_failed",
        "confirmed",
        "pending_pos_payment",
        "preparing",
        "ready_for_pickup",
        "completed",
        "cancelled",
        "refunded",
      ],
    },
  },
} as const
