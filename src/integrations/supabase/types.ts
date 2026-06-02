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
      agent_actions: {
        Row: {
          action_type: string
          created_at: string
          endpoint: string | null
          error_message: string | null
          id: string
          payload: Json | null
          result: Json | null
          session_id: string | null
          status: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          endpoint?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          session_id?: string | null
          status?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          endpoint?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          session_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      agent_decisions: {
        Row: {
          confidence: number | null
          created_at: string
          decision_type: string
          id: string
          input: Json | null
          model: string | null
          output: Json | null
          session_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          decision_type: string
          id?: string
          input?: Json | null
          model?: string | null
          output?: Json | null
          session_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          decision_type?: string
          id?: string
          input?: Json | null
          model?: string | null
          output?: Json | null
          session_id?: string | null
        }
        Relationships: []
      }
      agent_sessions: {
        Row: {
          channel: string | null
          customer_id: string | null
          ended_at: string | null
          id: string
          metadata: Json | null
          session_id: string
          started_at: string
          status: string
        }
        Insert: {
          channel?: string | null
          customer_id?: string | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          session_id: string
          started_at?: string
          status?: string
        }
        Update: {
          channel?: string | null
          customer_id?: string | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          session_id?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      api_consumers: {
        Row: {
          allowed_endpoints: string[] | null
          api_key: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          notes: string | null
          rate_limit_per_minute: number
          total_requests: number
          updated_at: string
        }
        Insert: {
          allowed_endpoints?: string[] | null
          api_key: string
          channel: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          notes?: string | null
          rate_limit_per_minute?: number
          total_requests?: number
          updated_at?: string
        }
        Update: {
          allowed_endpoints?: string[] | null
          api_key?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          notes?: string | null
          rate_limit_per_minute?: number
          total_requests?: number
          updated_at?: string
        }
        Relationships: []
      }
      api_integrations: {
        Row: {
          base_url: string | null
          config: Json | null
          created_at: string
          id: string
          integration_type: string
          last_error: string | null
          last_sync_at: string | null
          name: string
          status: string | null
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          config?: Json | null
          created_at?: string
          id?: string
          integration_type: string
          last_error?: string | null
          last_sync_at?: string | null
          name: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          config?: Json | null
          created_at?: string
          id?: string
          integration_type?: string
          last_error?: string | null
          last_sync_at?: string | null
          name?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      approval_history: {
        Row: {
          action: string
          actor: string | null
          approval_id: string
          comment: string | null
          created_at: string
          id: string
          stage: Database["public"]["Enums"]["approval_stage"]
        }
        Insert: {
          action: string
          actor?: string | null
          approval_id: string
          comment?: string | null
          created_at?: string
          id?: string
          stage: Database["public"]["Enums"]["approval_stage"]
        }
        Update: {
          action?: string
          actor?: string | null
          approval_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          stage?: Database["public"]["Enums"]["approval_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "approval_history_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          assigned_to: string | null
          created_at: string
          current_stage: Database["public"]["Enums"]["approval_stage"]
          decided_at: string | null
          decided_by: string | null
          entity_id: string
          entity_type: string
          id: string
          notes: string | null
          priority: string
          requested_by: string | null
          status: Database["public"]["Enums"]["approval_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          current_stage?: Database["public"]["Enums"]["approval_stage"]
          decided_at?: string | null
          decided_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          notes?: string | null
          priority?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          current_stage?: Database["public"]["Enums"]["approval_stage"]
          decided_at?: string | null
          decided_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          notes?: string | null
          priority?: string
          requested_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          folder_path: string | null
          id: string
          notes: string | null
          source: string | null
          status: string | null
          storage_provider: string | null
          tags: string[] | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          folder_path?: string | null
          id?: string
          notes?: string | null
          source?: string | null
          status?: string | null
          storage_provider?: string | null
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          folder_path?: string | null
          id?: string
          notes?: string | null
          source?: string | null
          status?: string | null
          storage_provider?: string | null
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          code: string | null
          created_at: string
          id: string
          name_ar: string
          name_en: string | null
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          name_ar: string
          name_en?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_interactions: {
        Row: {
          created_at: string
          delivered_at: string | null
          direction: string
          error_message: string | null
          id: string
          interaction_type: string
          manufacturing_order_id: string | null
          payload: Json | null
          quote_request_id: string | null
          response_payload: Json | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          direction: string
          error_message?: string | null
          id?: string
          interaction_type: string
          manufacturing_order_id?: string | null
          payload?: Json | null
          quote_request_id?: string | null
          response_payload?: Json | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          direction?: string
          error_message?: string | null
          id?: string
          interaction_type?: string
          manufacturing_order_id?: string | null
          payload?: Json | null
          quote_request_id?: string | null
          response_payload?: Json | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_interactions_manufacturing_order_id_fkey"
            columns: ["manufacturing_order_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_interactions_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_group_items: {
        Row: {
          duplicate_group_id: string
          id: string
          product_id: string
          similarity_reason: string | null
        }
        Insert: {
          duplicate_group_id: string
          id?: string
          product_id: string
          similarity_reason?: string | null
        }
        Update: {
          duplicate_group_id?: string
          id?: string
          product_id?: string
          similarity_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_group_items_duplicate_group_id_fkey"
            columns: ["duplicate_group_id"]
            isOneToOne: false
            referencedRelation: "duplicate_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_group_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_groups: {
        Row: {
          confidence_score: number | null
          created_at: string
          id: string
          status: string | null
          title: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          status?: string | null
          title: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          id?: string
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      export_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          export_type: string
          file_url: string | null
          filters: Json | null
          format: string
          id: string
          status: string
          target: string
          total_rows: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          export_type: string
          file_url?: string | null
          filters?: Json | null
          format: string
          id?: string
          status?: string
          target: string
          total_rows?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          export_type?: string
          file_url?: string | null
          filters?: Json | null
          format?: string
          id?: string
          status?: string
          target?: string
          total_rows?: number | null
        }
        Relationships: []
      }
      families: {
        Row: {
          category_id: string | null
          code: string | null
          created_at: string
          id: string
          name_ar: string
          name_en: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name_ar: string
          name_en?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name_ar?: string
          name_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "families_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          error_log: Json | null
          file_name: string
          id: string
          import_type: string
          invalid_rows: number | null
          status: string
          total_rows: number | null
          valid_rows: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_log?: Json | null
          file_name: string
          id?: string
          import_type: string
          invalid_rows?: number | null
          status?: string
          total_rows?: number | null
          valid_rows?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_log?: Json | null
          file_name?: string
          id?: string
          import_type?: string
          invalid_rows?: number | null
          status?: string
          total_rows?: number | null
          valid_rows?: number | null
        }
        Relationships: []
      }
      integration_configs: {
        Row: {
          config: Json | null
          created_at: string
          created_by: string | null
          id: string
          last_error: string | null
          last_sync_at: string | null
          name: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          name?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          name?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      manufacturing_order_status_transitions: {
        Row: {
          from_status: string
          to_status: string
        }
        Insert: {
          from_status: string
          to_status: string
        }
        Update: {
          from_status?: string
          to_status?: string
        }
        Relationships: []
      }
      manufacturing_orders: {
        Row: {
          actual_completion_date: string | null
          actual_start_date: string | null
          amount_paid: number | null
          approval_id: string | null
          created_at: string
          currency: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string | null
          delivery_date: string | null
          delivery_notes: string | null
          design_data: Json | null
          discount_amount: number | null
          discount_percent: number | null
          estimated_completion_date: string | null
          estimated_start_date: string | null
          final_price: number | null
          id: string
          order_number: string
          payment_status: string | null
          priority: string
          production_notes: string | null
          quality_notes: string | null
          quantity: number
          quote_request_id: string | null
          specifications: Json | null
          status: string
          total_price: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          actual_completion_date?: string | null
          actual_start_date?: string | null
          amount_paid?: number | null
          approval_id?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_notes?: string | null
          design_data?: Json | null
          discount_amount?: number | null
          discount_percent?: number | null
          estimated_completion_date?: string | null
          estimated_start_date?: string | null
          final_price?: number | null
          id?: string
          order_number: string
          payment_status?: string | null
          priority?: string
          production_notes?: string | null
          quality_notes?: string | null
          quantity?: number
          quote_request_id?: string | null
          specifications?: Json | null
          status?: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          actual_completion_date?: string | null
          actual_start_date?: string | null
          amount_paid?: number | null
          approval_id?: string | null
          created_at?: string
          currency?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          delivery_notes?: string | null
          design_data?: Json | null
          discount_amount?: number | null
          discount_percent?: number | null
          estimated_completion_date?: string | null
          estimated_start_date?: string | null
          final_price?: number | null
          id?: string
          order_number?: string
          payment_status?: string | null
          priority?: string
          production_notes?: string | null
          quality_notes?: string | null
          quantity?: number
          quote_request_id?: string | null
          specifications?: Json | null
          status?: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manufacturing_orders_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requisition_items: {
        Row: {
          created_at: string
          id: string
          issued_quantity: number | null
          product_code: string | null
          product_id: string | null
          product_name: string | null
          requested_quantity: number
          requisition_id: string
          status: string
          supplier_id: string | null
          supplier_name: string | null
          total_cost: number | null
          unit: string | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          issued_quantity?: number | null
          product_code?: string | null
          product_id?: string | null
          product_name?: string | null
          requested_quantity?: number
          requisition_id: string
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          issued_quantity?: number | null
          product_code?: string | null
          product_id?: string | null
          product_name?: string | null
          requested_quantity?: number
          requisition_id?: string
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total_cost?: number | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_requisition_items_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "material_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requisitions: {
        Row: {
          approval_id: string | null
          created_at: string
          id: string
          issued_at: string | null
          manufacturing_order_id: string | null
          notes: string | null
          requisition_number: string
          status: string
          updated_at: string
        }
        Insert: {
          approval_id?: string | null
          created_at?: string
          id?: string
          issued_at?: string | null
          manufacturing_order_id?: string | null
          notes?: string | null
          requisition_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          approval_id?: string | null
          created_at?: string
          id?: string
          issued_at?: string | null
          manufacturing_order_id?: string | null
          notes?: string | null
          requisition_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_requisitions_manufacturing_order_id_fkey"
            columns: ["manufacturing_order_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          kind: string
          link: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: string
          link?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: string
          link?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string
          id: string
          new_price: number | null
          old_price: number | null
          product_id: string
          source: string | null
          supplier_id: string | null
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_price?: number | null
          old_price?: number | null
          product_id: string
          source?: string | null
          supplier_id?: string | null
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_price?: number | null
          old_price?: number | null
          product_id?: string
          source?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      prices: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          client_price: number | null
          created_at: string
          currency: string | null
          id: string
          installation_cost: number | null
          maintenance_cost: number | null
          margin_percent: number | null
          operation_cost: number | null
          product_id: string
          project_price: number | null
          purchase_price: number | null
          reference_price: number | null
          retail_price: number | null
          selling_price: number | null
          source: string | null
          status: string | null
          supplier_id: string | null
          transport_cost: number | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          wholesale_price: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          client_price?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          installation_cost?: number | null
          maintenance_cost?: number | null
          margin_percent?: number | null
          operation_cost?: number | null
          product_id: string
          project_price?: number | null
          purchase_price?: number | null
          reference_price?: number | null
          retail_price?: number | null
          selling_price?: number | null
          source?: string | null
          status?: string | null
          supplier_id?: string | null
          transport_cost?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          wholesale_price?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          client_price?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          installation_cost?: number | null
          maintenance_cost?: number | null
          margin_percent?: number | null
          operation_cost?: number | null
          product_id?: string
          project_price?: number | null
          purchase_price?: number | null
          reference_price?: number | null
          retail_price?: number | null
          selling_price?: number | null
          source?: string | null
          status?: string | null
          supplier_id?: string | null
          transport_cost?: number | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          conditions: Json | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          priority: number
          rule_type: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          value: number
        }
        Insert: {
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          priority?: number
          rule_type: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          value: number
        }
        Update: {
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          priority?: number
          rule_type?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          value?: number
        }
        Relationships: []
      }
      product_assets: {
        Row: {
          asset_id: string
          asset_role: Database["public"]["Enums"]["asset_role"]
          created_at: string
          id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          asset_id: string
          asset_role?: Database["public"]["Enums"]["asset_role"]
          created_at?: string
          id?: string
          product_id: string
          sort_order?: number
        }
        Update: {
          asset_id?: string
          asset_role?: Database["public"]["Enums"]["asset_role"]
          created_at?: string
          id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_requests: {
        Row: {
          assigned_to: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string
          estimated_budget: number | null
          id: string
          notes: string | null
          priority: string
          quantity: number | null
          request_type: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          estimated_budget?: number | null
          id?: string
          notes?: string | null
          priority?: string
          quantity?: number | null
          request_type: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          estimated_budget?: number | null
          id?: string
          notes?: string | null
          priority?: string
          quantity?: number | null
          request_type?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          az_code: string
          category_id: string | null
          confidence_level: string | null
          created_at: string
          created_by: string | null
          default_price_id: string | null
          default_supplier_id: string | null
          description_ar: string | null
          description_en: string | null
          egs_code: string | null
          external_links: Json | null
          family_id: string | null
          faq: Json | null
          gpc_brick_title: string | null
          gpc_class: string | null
          gpc_family: string | null
          gpc_segment: string | null
          gs1_gpc_brick: string | null
          id: string
          installation_notes: string | null
          internal_notes: string | null
          item_type: Database["public"]["Enums"]["item_type"]
          maintenance_notes: string | null
          marketing_content: string | null
          name_ar: string
          name_en: string | null
          operational_track: string | null
          product_code: string | null
          search_keywords: string[] | null
          sector_ar: string | null
          short_description_ar: string | null
          short_description_en: string | null
          source: string | null
          status: Database["public"]["Enums"]["item_status"]
          tags: string[] | null
          technical_content: string | null
          unit_id: string | null
          updated_at: string
          warranty_info: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          az_code: string
          category_id?: string | null
          confidence_level?: string | null
          created_at?: string
          created_by?: string | null
          default_price_id?: string | null
          default_supplier_id?: string | null
          description_ar?: string | null
          description_en?: string | null
          egs_code?: string | null
          external_links?: Json | null
          family_id?: string | null
          faq?: Json | null
          gpc_brick_title?: string | null
          gpc_class?: string | null
          gpc_family?: string | null
          gpc_segment?: string | null
          gs1_gpc_brick?: string | null
          id?: string
          installation_notes?: string | null
          internal_notes?: string | null
          item_type?: Database["public"]["Enums"]["item_type"]
          maintenance_notes?: string | null
          marketing_content?: string | null
          name_ar: string
          name_en?: string | null
          operational_track?: string | null
          product_code?: string | null
          search_keywords?: string[] | null
          sector_ar?: string | null
          short_description_ar?: string | null
          short_description_en?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          tags?: string[] | null
          technical_content?: string | null
          unit_id?: string | null
          updated_at?: string
          warranty_info?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          az_code?: string
          category_id?: string | null
          confidence_level?: string | null
          created_at?: string
          created_by?: string | null
          default_price_id?: string | null
          default_supplier_id?: string | null
          description_ar?: string | null
          description_en?: string | null
          egs_code?: string | null
          external_links?: Json | null
          family_id?: string | null
          faq?: Json | null
          gpc_brick_title?: string | null
          gpc_class?: string | null
          gpc_family?: string | null
          gpc_segment?: string | null
          gs1_gpc_brick?: string | null
          id?: string
          installation_notes?: string | null
          internal_notes?: string | null
          item_type?: Database["public"]["Enums"]["item_type"]
          maintenance_notes?: string | null
          marketing_content?: string | null
          name_ar?: string
          name_en?: string | null
          operational_track?: string | null
          product_code?: string | null
          search_keywords?: string[] | null
          sector_ar?: string | null
          short_description_ar?: string | null
          short_description_en?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          tags?: string[] | null
          technical_content?: string | null
          unit_id?: string | null
          updated_at?: string
          warranty_info?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_default_supplier_id_fkey"
            columns: ["default_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          accessories: Json | null
          chatbot_session_id: string | null
          components: Json | null
          created_at: string
          currency: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_notes: string | null
          customer_phone: string | null
          customer_response: string | null
          customer_response_at: string | null
          design_data: Json | null
          design_file_type: string | null
          design_file_url: string | null
          design_preview_url: string | null
          dimensions: Json | null
          finishes: Json | null
          id: string
          labor_cost: number | null
          materials: Json | null
          materials_cost: number | null
          overhead_cost: number | null
          pricing_breakdown: Json | null
          profit_margin: number | null
          quantity: number
          quote_valid_until: string | null
          quoted_at: string | null
          rejection_reason: string | null
          request_id: string
          selling_price: number | null
          special_requirements: Json | null
          status: string
          total_cost: number | null
          updated_at: string
        }
        Insert: {
          accessories?: Json | null
          chatbot_session_id?: string | null
          components?: Json | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          customer_response?: string | null
          customer_response_at?: string | null
          design_data?: Json | null
          design_file_type?: string | null
          design_file_url?: string | null
          design_preview_url?: string | null
          dimensions?: Json | null
          finishes?: Json | null
          id?: string
          labor_cost?: number | null
          materials?: Json | null
          materials_cost?: number | null
          overhead_cost?: number | null
          pricing_breakdown?: Json | null
          profit_margin?: number | null
          quantity?: number
          quote_valid_until?: string | null
          quoted_at?: string | null
          rejection_reason?: string | null
          request_id: string
          selling_price?: number | null
          special_requirements?: Json | null
          status?: string
          total_cost?: number | null
          updated_at?: string
        }
        Update: {
          accessories?: Json | null
          chatbot_session_id?: string | null
          components?: Json | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          customer_response?: string | null
          customer_response_at?: string | null
          design_data?: Json | null
          design_file_type?: string | null
          design_file_url?: string | null
          design_preview_url?: string | null
          dimensions?: Json | null
          finishes?: Json | null
          id?: string
          labor_cost?: number | null
          materials?: Json | null
          materials_cost?: number | null
          overhead_cost?: number | null
          pricing_breakdown?: Json | null
          profit_margin?: number | null
          quantity?: number
          quote_valid_until?: string | null
          quoted_at?: string | null
          rejection_reason?: string | null
          request_id?: string
          selling_price?: number | null
          special_requirements?: Json | null
          status?: string
          total_cost?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      supplier_inventory: {
        Row: {
          availability_status: string | null
          available_quantity: number | null
          created_at: string
          currency: string | null
          id: string
          internal_product_id: string | null
          last_sync_at: string | null
          source_type: string | null
          source_url: string | null
          supplier_id: string
          supplier_price: number | null
          supplier_product_name: string | null
          supplier_sku: string | null
          sync_status: string | null
          updated_at: string
        }
        Insert: {
          availability_status?: string | null
          available_quantity?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          internal_product_id?: string | null
          last_sync_at?: string | null
          source_type?: string | null
          source_url?: string | null
          supplier_id: string
          supplier_price?: number | null
          supplier_product_name?: string | null
          supplier_sku?: string | null
          sync_status?: string | null
          updated_at?: string
        }
        Update: {
          availability_status?: string | null
          available_quantity?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          internal_product_id?: string | null
          last_sync_at?: string | null
          source_type?: string | null
          source_url?: string | null
          supplier_id?: string
          supplier_price?: number | null
          supplier_product_name?: string | null
          supplier_sku?: string | null
          sync_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_inventory_internal_product_id_fkey"
            columns: ["internal_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_inventory_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          api_url: string | null
          contact_name: string | null
          coverage_areas: string[] | null
          created_at: string
          delivery_time: string | null
          email: string | null
          id: string
          last_sync_at: string | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          price_file_url: string | null
          rating: number | null
          status: string | null
          supplier_tier: Database["public"]["Enums"]["supplier_tier"] | null
          supplier_type: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          api_url?: string | null
          contact_name?: string | null
          coverage_areas?: string[] | null
          created_at?: string
          delivery_time?: string | null
          email?: string | null
          id?: string
          last_sync_at?: string | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          price_file_url?: string | null
          rating?: number | null
          status?: string | null
          supplier_tier?: Database["public"]["Enums"]["supplier_tier"] | null
          supplier_type?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          api_url?: string | null
          contact_name?: string | null
          coverage_areas?: string[] | null
          created_at?: string
          delivery_time?: string | null
          email?: string | null
          id?: string
          last_sync_at?: string | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          price_file_url?: string | null
          rating?: number | null
          status?: string | null
          supplier_tier?: Database["public"]["Enums"]["supplier_tier"] | null
          supplier_type?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      units: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
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
      webhook_logs: {
        Row: {
          channel: string | null
          consumer_id: string | null
          consumer_name: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          ip_address: string | null
          method: string
          request_payload: Json | null
          response_payload: Json | null
          response_time_ms: number | null
          status_code: number | null
          user_agent: string | null
        }
        Insert: {
          channel?: string | null
          consumer_id?: string | null
          consumer_name?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method: string
          request_payload?: Json | null
          response_payload?: Json | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Update: {
          channel?: string | null
          consumer_id?: string | null
          consumer_name?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method?: string
          request_payload?: Json | null
          response_payload?: Json | null
          response_time_ms?: number | null
          status_code?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_consumer_id_fkey"
            columns: ["consumer_id"]
            isOneToOne: false
            referencedRelation: "api_consumers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: { Args: never; Returns: string }
      generate_requisition_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authorized: { Args: { _user_id: string }; Returns: boolean }
      next_az_code: {
        Args: { _category?: string; _family?: string; _type: string }
        Returns: string
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
      approval_stage:
        | "content_review"
        | "manager_review"
        | "final_approval"
        | "internal_review"
      approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "changes_requested"
        | "cancelled"
      asset_role:
        | "main_image"
        | "gallery"
        | "before"
        | "after"
        | "technical_drawing"
        | "supplier_image"
        | "site_photo"
        | "invoice_attachment"
        | "warranty_document"
        | "datasheet"
        | "model_3d"
        | "cad_file"
      item_status:
        | "draft"
        | "needs_review"
        | "duplicate_suspected"
        | "content_incomplete"
        | "pricing_incomplete"
        | "supplier_pending"
        | "approved"
        | "rejected"
        | "exported"
        | "archived"
      item_type:
        | "product"
        | "service"
        | "work_item"
        | "material"
        | "tool"
        | "spare_part"
        | "finish_item"
        | "custom_unit"
        | "supplier_item"
        | "package"
        | "bundle"
      supplier_tier:
        | "first_tier"
        | "second_tier"
        | "backup"
        | "local"
        | "imported"
        | "internal_workshop"
        | "factory"
        | "marketplace"
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
      app_role: ["admin", "editor", "viewer"],
      approval_stage: [
        "content_review",
        "manager_review",
        "final_approval",
        "internal_review",
      ],
      approval_status: [
        "pending",
        "approved",
        "rejected",
        "changes_requested",
        "cancelled",
      ],
      asset_role: [
        "main_image",
        "gallery",
        "before",
        "after",
        "technical_drawing",
        "supplier_image",
        "site_photo",
        "invoice_attachment",
        "warranty_document",
        "datasheet",
        "model_3d",
        "cad_file",
      ],
      item_status: [
        "draft",
        "needs_review",
        "duplicate_suspected",
        "content_incomplete",
        "pricing_incomplete",
        "supplier_pending",
        "approved",
        "rejected",
        "exported",
        "archived",
      ],
      item_type: [
        "product",
        "service",
        "work_item",
        "material",
        "tool",
        "spare_part",
        "finish_item",
        "custom_unit",
        "supplier_item",
        "package",
        "bundle",
      ],
      supplier_tier: [
        "first_tier",
        "second_tier",
        "backup",
        "local",
        "imported",
        "internal_workshop",
        "factory",
        "marketplace",
      ],
    },
  },
} as const
