export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string
          account_number: string
          name: string
          cost_center: string | null
          address1: string | null
          address2: string | null
          city: string | null
          state: string | null
          zip: string | null
          contact_name: string | null
          contact_email: string | null
          contact_phone: string | null
          external_reference_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_number: string
          name: string
          cost_center?: string | null
          address1?: string | null
          address2?: string | null
          city?: string | null
          state?: string | null
          zip?: string | null
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          external_reference_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_number?: string
          name?: string
          cost_center?: string | null
          address1?: string | null
          address2?: string | null
          city?: string | null
          state?: string | null
          zip?: string | null
          contact_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          external_reference_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          transaction_number: string
          transaction_date: string
          client_id: string
          special_instructions: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          transaction_number: string
          transaction_date: string
          client_id: string
          special_instructions?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          transaction_number?: string
          transaction_date?: string
          client_id?: string
          special_instructions?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      assets: {
        Row: {
          id: string
          internal_asset_id: string
          serial_generated: boolean
          transaction_id: string
          serial_number: string | null
          asset_type: 'desktop' | 'server' | 'laptop' | 'monitor' | 'printer' | 'phone' | 'tv' | 'network' | 'other'
          tracking_mode: 'serialized' | 'bulk'
          manufacturer: string | null
          model: string | null
          model_name: string | null
          mfg_part_number: string | null
          asset_tag: string | null
          quantity: number
          unit_of_measure: string | null
          weight: number | null
          notes: string | null
          bin_location: string | null
          asset_destination: 'external_reuse' | 'recycle' | 'internal_reuse' | 'pending' | null
          available_for_sale: boolean
          status: 'received' | 'in_process' | 'tested' | 'graded' | 'sanitized' | 'available' | 'sold' | 'recycled' | 'on_hold'
          external_reference_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          internal_asset_id?: string
          serial_generated?: boolean
          transaction_id: string
          serial_number?: string | null
          asset_type: 'desktop' | 'server' | 'laptop' | 'monitor' | 'printer' | 'phone' | 'tv' | 'network' | 'other'
          tracking_mode?: 'serialized' | 'bulk'
          manufacturer?: string | null
          model?: string | null
          model_name?: string | null
          mfg_part_number?: string | null
          asset_tag?: string | null
          quantity?: number
          unit_of_measure?: string | null
          weight?: number | null
          notes?: string | null
          bin_location?: string | null
          asset_destination?: 'external_reuse' | 'recycle' | 'internal_reuse' | 'pending' | null
          available_for_sale?: boolean
          status?: 'received' | 'in_process' | 'tested' | 'graded' | 'sanitized' | 'available' | 'sold' | 'recycled' | 'on_hold'
          external_reference_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          internal_asset_id?: string
          serial_generated?: boolean
          transaction_id?: string
          serial_number?: string | null
          asset_type?: 'desktop' | 'server' | 'laptop' | 'monitor' | 'printer' | 'phone' | 'tv' | 'network' | 'other'
          tracking_mode?: 'serialized' | 'bulk'
          manufacturer?: string | null
          model?: string | null
          model_name?: string | null
          mfg_part_number?: string | null
          asset_tag?: string | null
          quantity?: number
          unit_of_measure?: string | null
          weight?: number | null
          notes?: string | null
          bin_location?: string | null
          asset_destination?: 'external_reuse' | 'recycle' | 'internal_reuse' | 'pending' | null
          available_for_sale?: boolean
          status?: 'received' | 'in_process' | 'tested' | 'graded' | 'sanitized' | 'available' | 'sold' | 'recycled' | 'on_hold'
          external_reference_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      asset_hard_drives: {
        Row: {
          id: string
          asset_id: string
          drive_number: number
          serial_number: string | null
          manufacturer: string | null
          size: string | null
          sanitization_method: 'wipe' | 'destruct_shred' | 'clear_overwrite' | 'none' | null
          sanitization_details: string | null
          wipe_verification_method: string | null
          sanitization_validation: string | null
          sanitization_tech: string | null
          sanitization_date: string | null
          date_crushed: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          drive_number: number
          serial_number?: string | null
          manufacturer?: string | null
          size?: string | null
          sanitization_method?: 'wipe' | 'destruct_shred' | 'clear_overwrite' | 'none' | null
          sanitization_details?: string | null
          wipe_verification_method?: string | null
          sanitization_validation?: string | null
          sanitization_tech?: string | null
          sanitization_date?: string | null
          date_crushed?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          drive_number?: number
          serial_number?: string | null
          manufacturer?: string | null
          size?: string | null
          sanitization_method?: 'wipe' | 'destruct_shred' | 'clear_overwrite' | 'none' | null
          sanitization_details?: string | null
          wipe_verification_method?: string | null
          sanitization_validation?: string | null
          sanitization_tech?: string | null
          sanitization_date?: string | null
          date_crushed?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      asset_grading: {
        Row: {
          id: string
          asset_id: string
          cosmetic_category: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | null
          functioning_category: 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | null
          does_unit_power_up: boolean | null
          does_unit_function_properly: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          cosmetic_category?: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | null
          functioning_category?: 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | null
          does_unit_power_up?: boolean | null
          does_unit_function_properly?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          cosmetic_category?: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | null
          functioning_category?: 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | null
          does_unit_power_up?: boolean | null
          does_unit_function_properly?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      asset_type_details: {
        Row: {
          id: string
          asset_id: string
          details: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          details?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          details?: Json
          created_at?: string
          updated_at?: string
        }
      }
      asset_type_field_definitions: {
        Row: {
          id: string
          asset_type: 'desktop' | 'server' | 'laptop' | 'monitor' | 'printer' | 'phone' | 'tv' | 'network' | 'other'
          field_name: string
          field_label: string
          field_type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'json_array'
          field_options: Json | null
          field_group: string
          is_required: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_type: 'desktop' | 'server' | 'laptop' | 'monitor' | 'printer' | 'phone' | 'tv' | 'network' | 'other'
          field_name: string
          field_label: string
          field_type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'json_array'
          field_options?: Json | null
          field_group?: string
          is_required?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_type?: 'desktop' | 'server' | 'laptop' | 'monitor' | 'printer' | 'phone' | 'tv' | 'network' | 'other'
          field_name?: string
          field_label?: string
          field_type?: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'json_array'
          field_options?: Json | null
          field_group?: string
          is_required?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      asset_sanitization: {
        Row: {
          id: string
          asset_id: string
          sanitization_method: 'wipe' | 'destruct_shred' | 'clear_overwrite' | 'none' | null
          sanitization_details: string | null
          wipe_verification_method: string | null
          hd_sanitization_validation: string | null
          validator_name: string | null
          validation_date: string | null
          inspection_tech: string | null
          inspection_datetime: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          sanitization_method?: 'wipe' | 'destruct_shred' | 'clear_overwrite' | 'none' | null
          sanitization_details?: string | null
          wipe_verification_method?: string | null
          hd_sanitization_validation?: string | null
          validator_name?: string | null
          validation_date?: string | null
          inspection_tech?: string | null
          inspection_datetime?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          sanitization_method?: 'wipe' | 'destruct_shred' | 'clear_overwrite' | 'none' | null
          sanitization_details?: string | null
          wipe_verification_method?: string | null
          hd_sanitization_validation?: string | null
          validator_name?: string | null
          validation_date?: string | null
          inspection_tech?: string | null
          inspection_datetime?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      buyers: {
        Row: {
          id: string
          name: string
          address1: string | null
          address2: string | null
          city: string | null
          state: string | null
          zip: string | null
          country: string | null
          contact_name: string | null
          contact_number: string | null
          ebay_name: string | null
          email: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address1?: string | null
          address2?: string | null
          city?: string | null
          state?: string | null
          zip?: string | null
          country?: string | null
          contact_name?: string | null
          contact_number?: string | null
          ebay_name?: string | null
          email?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address1?: string | null
          address2?: string | null
          city?: string | null
          state?: string | null
          zip?: string | null
          country?: string | null
          contact_name?: string | null
          contact_number?: string | null
          ebay_name?: string | null
          email?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      asset_sales: {
        Row: {
          id: string
          asset_id: string
          buyer_id: string | null
          logista_so: string | null
          customer_po_number: string | null
          sold_to_name: string | null
          sold_to_address1: string | null
          sold_to_address2: string | null
          sold_to_city: string | null
          sold_to_state: string | null
          sold_to_zip: string | null
          sold_to_country: string | null
          sold_to_contact_name: string | null
          sold_to_contact_number: string | null
          sold_to_ebay_name: string | null
          ebay_item_number: string | null
          sale_price: number | null
          sold_date: string | null
          shipment_date: string | null
          shipment_carrier: string | null
          shipment_method: string | null
          shipment_tracking_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          buyer_id?: string | null
          logista_so?: string | null
          customer_po_number?: string | null
          sold_to_name?: string | null
          sold_to_address1?: string | null
          sold_to_address2?: string | null
          sold_to_city?: string | null
          sold_to_state?: string | null
          sold_to_zip?: string | null
          sold_to_country?: string | null
          sold_to_contact_name?: string | null
          sold_to_contact_number?: string | null
          sold_to_ebay_name?: string | null
          ebay_item_number?: string | null
          sale_price?: number | null
          sold_date?: string | null
          shipment_date?: string | null
          shipment_carrier?: string | null
          shipment_method?: string | null
          shipment_tracking_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          buyer_id?: string | null
          logista_so?: string | null
          customer_po_number?: string | null
          sold_to_name?: string | null
          sold_to_address1?: string | null
          sold_to_address2?: string | null
          sold_to_city?: string | null
          sold_to_state?: string | null
          sold_to_zip?: string | null
          sold_to_country?: string | null
          sold_to_contact_name?: string | null
          sold_to_contact_number?: string | null
          sold_to_ebay_name?: string | null
          ebay_item_number?: string | null
          sale_price?: number | null
          sold_date?: string | null
          shipment_date?: string | null
          shipment_carrier?: string | null
          shipment_method?: string | null
          shipment_tracking_number?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      asset_status_history: {
        Row: {
          id: string
          asset_id: string
          previous_status: string | null
          new_status: string
          reason_for_change: string | null
          explanation: string | null
          changed_by: string | null
          changed_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          previous_status?: string | null
          new_status: string
          reason_for_change?: string | null
          explanation?: string | null
          changed_by?: string | null
          changed_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          previous_status?: string | null
          new_status?: string
          reason_for_change?: string | null
          explanation?: string | null
          changed_by?: string | null
          changed_at?: string
        }
      }
      inventory: {
        Row: {
          id: string
          asset_id: string | null
          part_number: string | null
          description: string | null
          location: string
          quantity_on_hand: number
          unit_of_measure: string
          status: 'available' | 'reserved' | 'in_process' | 'quarantine'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id?: string | null
          part_number?: string | null
          description?: string | null
          location: string
          quantity_on_hand?: number
          unit_of_measure?: string
          status?: 'available' | 'reserved' | 'in_process' | 'quarantine'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string | null
          part_number?: string | null
          description?: string | null
          location?: string
          quantity_on_hand?: number
          unit_of_measure?: string
          status?: 'available' | 'reserved' | 'in_process' | 'quarantine'
          created_at?: string
          updated_at?: string
        }
      }
      inventory_journal: {
        Row: {
          id: string
          inventory_id: string | null
          asset_id: string | null
          transaction_id: string | null
          movement_type: 'receipt' | 'issue' | 'transfer' | 'split' | 'correction' | 'reversal'
          quantity: number
          from_location: string | null
          to_location: string | null
          reference_number: string | null
          reason: string | null
          performed_by: string | null
          performed_at: string
        }
        Insert: {
          id?: string
          inventory_id?: string | null
          asset_id?: string | null
          transaction_id?: string | null
          movement_type: 'receipt' | 'issue' | 'transfer' | 'split' | 'correction' | 'reversal'
          quantity: number
          from_location?: string | null
          to_location?: string | null
          reference_number?: string | null
          reason?: string | null
          performed_by?: string | null
          performed_at?: string
        }
        Update: {
          id?: string
          inventory_id?: string | null
          asset_id?: string | null
          transaction_id?: string | null
          movement_type?: 'receipt' | 'issue' | 'transfer' | 'split' | 'correction' | 'reversal'
          quantity?: number
          from_location?: string | null
          to_location?: string | null
          reference_number?: string | null
          reason?: string | null
          performed_by?: string | null
          performed_at?: string
        }
      }
      client_revenue_terms: {
        Row: {
          id: string
          client_id: string
          term_type: 'flat_fee' | 'percentage' | 'tiered' | 'threshold'
          term_details: Json
          effective_date: string
          expiration_date: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          term_type: 'flat_fee' | 'percentage' | 'tiered' | 'threshold'
          term_details: Json
          effective_date: string
          expiration_date?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          term_type?: 'flat_fee' | 'percentage' | 'tiered' | 'threshold'
          term_details?: Json
          effective_date?: string
          expiration_date?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      asset_settlement: {
        Row: {
          id: string
          asset_id: string
          sale_id: string
          revenue_term_id: string
          sale_amount: number
          client_share: number
          logista_share: number
          settlement_date: string | null
          settled: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          sale_id: string
          revenue_term_id: string
          sale_amount: number
          client_share: number
          logista_share: number
          settlement_date?: string | null
          settled?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          sale_id?: string
          revenue_term_id?: string
          sale_amount?: number
          client_share?: number
          logista_share?: number
          settlement_date?: string | null
          settled?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      routing_rules: {
        Row: {
          id: string
          name: string
          description: string | null
          priority: number
          conditions: Json
          action: 'recycle' | 'test' | 'external_reuse' | 'internal_reuse' | 'manual_review'
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          priority?: number
          conditions: Json
          action: 'recycle' | 'test' | 'external_reuse' | 'internal_reuse' | 'manual_review'
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          priority?: number
          conditions?: Json
          action?: 'recycle' | 'test' | 'external_reuse' | 'internal_reuse' | 'manual_review'
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'admin' | 'operator' | 'viewer' | 'receiving_tech' | 'client_portal_user'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'admin' | 'operator' | 'viewer' | 'receiving_tech' | 'client_portal_user'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'admin' | 'operator' | 'viewer' | 'receiving_tech' | 'client_portal_user'
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_operator_or_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      can_create_assets: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_client_portal_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_internal_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Convenience type aliases
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Shorthand row types
export type Client = Tables<'clients'>
export type Transaction = Tables<'transactions'>
export type Asset = Tables<'assets'>
export type AssetHardDrive = Tables<'asset_hard_drives'>
export type AssetGrading = Tables<'asset_grading'>
export type AssetTypeDetails = Tables<'asset_type_details'>
export type AssetTypeFieldDefinition = Tables<'asset_type_field_definitions'>
export type AssetSanitization = Tables<'asset_sanitization'>
export type Buyer = Tables<'buyers'>
export type AssetSales = Tables<'asset_sales'>
export type AssetStatusHistory = Tables<'asset_status_history'>
export type Inventory = Tables<'inventory'>
export type InventoryJournal = Tables<'inventory_journal'>
export type ClientRevenueTerms = Tables<'client_revenue_terms'>
export type AssetSettlement = Tables<'asset_settlement'>
export type RoutingRule = Tables<'routing_rules'>
export type UserProfile = Tables<'user_profiles'>

// Enum types extracted for reuse
export type AssetType = Asset['asset_type']
export type AssetDestination = NonNullable<Asset['asset_destination']>
export type AssetStatus = Asset['status']
export type TrackingMode = Asset['tracking_mode']
export type CosmeticCategory = NonNullable<AssetGrading['cosmetic_category']>
export type FunctioningCategory = NonNullable<AssetGrading['functioning_category']>
export type SanitizationMethod = NonNullable<AssetSanitization['sanitization_method']>
export type DriveSanitizationMethod = NonNullable<AssetHardDrive['sanitization_method']>
export type InventoryStatus = Inventory['status']
export type MovementType = InventoryJournal['movement_type']
export type RevenueTermType = ClientRevenueTerms['term_type']
export type RoutingAction = RoutingRule['action']
export type FieldType = AssetTypeFieldDefinition['field_type']
export type UserRole = UserProfile['role']
