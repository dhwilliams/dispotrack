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
          transaction_id: string
          serial_number: string
          asset_type: 'desktop' | 'server' | 'laptop' | 'monitor' | 'printer' | 'phone' | 'tv' | 'network' | 'other'
          manufacturer: string | null
          model: string | null
          model_name: string | null
          mfg_part_number: string | null
          asset_tag: string | null
          quantity: number
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
          transaction_id: string
          serial_number: string
          asset_type: 'desktop' | 'server' | 'laptop' | 'monitor' | 'printer' | 'phone' | 'tv' | 'network' | 'other'
          manufacturer?: string | null
          model?: string | null
          model_name?: string | null
          mfg_part_number?: string | null
          asset_tag?: string | null
          quantity?: number
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
          transaction_id?: string
          serial_number?: string
          asset_type?: 'desktop' | 'server' | 'laptop' | 'monitor' | 'printer' | 'phone' | 'tv' | 'network' | 'other'
          manufacturer?: string | null
          model?: string | null
          model_name?: string | null
          mfg_part_number?: string | null
          asset_tag?: string | null
          quantity?: number
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
          date_crushed: string | null
          created_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          drive_number: number
          serial_number?: string | null
          manufacturer?: string | null
          size?: string | null
          date_crushed?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          drive_number?: number
          serial_number?: string | null
          manufacturer?: string | null
          size?: string | null
          date_crushed?: string | null
          created_at?: string
        }
      }
      asset_hardware: {
        Row: {
          id: string
          asset_id: string
          total_memory: string | null
          optical_drive_type: string | null
          color: string | null
          chassis_type: string | null
          cpu_info: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          total_memory?: string | null
          optical_drive_type?: string | null
          color?: string | null
          chassis_type?: string | null
          cpu_info?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          total_memory?: string | null
          optical_drive_type?: string | null
          color?: string | null
          chassis_type?: string | null
          cpu_info?: Json
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
      asset_sales: {
        Row: {
          id: string
          asset_id: string
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
      user_profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'admin' | 'operator' | 'viewer'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'admin' | 'operator' | 'viewer'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'admin' | 'operator' | 'viewer'
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
export type AssetHardware = Tables<'asset_hardware'>
export type AssetGrading = Tables<'asset_grading'>
export type AssetTypeDetails = Tables<'asset_type_details'>
export type AssetSanitization = Tables<'asset_sanitization'>
export type AssetSales = Tables<'asset_sales'>
export type AssetStatusHistory = Tables<'asset_status_history'>
export type UserProfile = Tables<'user_profiles'>

// Enum types extracted for reuse
export type AssetType = Asset['asset_type']
export type AssetDestination = NonNullable<Asset['asset_destination']>
export type AssetStatus = Asset['status']
export type CosmeticCategory = NonNullable<AssetGrading['cosmetic_category']>
export type FunctioningCategory = NonNullable<AssetGrading['functioning_category']>
export type SanitizationMethod = NonNullable<AssetSanitization['sanitization_method']>
export type UserRole = UserProfile['role']
