export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: {
          contact_info: string
          id: string
          name: string
        }
        Insert: {
          contact_info: string
          id: string
          name: string
        }
        Update: {
          contact_info?: string
          id?: string
          name?: string
        }
      }
      company_settings: {
        Row: {
          id: number
          settings: Json
        }
        Insert: {
          id: number
          settings: Json
        }
        Update: {
          id?: number
          settings?: Json
        }
      }
      customer_master: {
        Row: {
          customer_id: string
          name: string
          address: string | null
          gst_number: string | null
          email: string | null
          phone: string | null
          created_at: string
        }
        Insert: {
          customer_id?: string
          name: string
          address?: string | null
          gst_number?: string | null
          email?: string | null
          phone?: string | null
          created_at?: string
        }
        Update: {
          customer_id?: string
          name?: string
          address?: string | null
          gst_number?: string | null
          email?: string | null
          phone?: string | null
          created_at?: string
        }
      }
      deletion_log: {
        Row: {
          client_name: string
          deleted_at: string
          deleted_by: string
          docket_id: string
          id: number
          reason: string
        }
        Insert: {
          client_name: string
          deleted_at: string
          deleted_by: string
          docket_id: string
          id?: number
          reason: string
        }
        Update: {
          client_name?: string
          deleted_at?: string
          deleted_by?: string
          docket_id?: string
          id?: number
          reason?: string
        }
      }
      dockets: {
        Row: {
          agent_id: string | null
          client: Json
          comments: Json
          created_at: string
          created_by: string
          files: Json
          id: string
          invoices: Json
          itinerary: Json
          passengers: Json
          payments: Json
          search_tags: string[]
          status: string
          tag: string
          updated_at: string
        }
        Insert: {
          agent_id: string | null
          client: Json
          comments: Json
          created_at: string
          created_by: string
          files: Json
          id: string
          invoices: Json
          itinerary: Json
          passengers: Json
          payments: Json
          search_tags: string[]
          status: string
          tag: string
          updated_at: string
        }
        Update: {
          agent_id?: string | null
          client?: Json
          comments?: Json
          created_at?: string
          created_by?: string
          files?: Json
          id?: string
          invoices?: Json
          itinerary?: Json
          passengers?: Json
          payments?: Json
          search_tags?: string[]
          status?: string
          tag?: string
          updated_at?: string
        }
      }
      invoice_master: {
        Row: {
          invoice_id: string
          invoice_number: string
          docket_id: string
          customer_id: string
          invoice_date: string
          due_date: string
          billed_to: Json
          line_items: Json
          subtotal: number
          gst_amount: number
          grand_total: number
          gst_type: string
          place_of_supply: string
          terms: string
          notes: string
          company_settings_snapshot: Json
          created_at: string
          created_by: string
        }
        Insert: {
          invoice_id?: string
          invoice_number: string
          docket_id: string
          customer_id: string
          invoice_date: string
          due_date: string
          billed_to: Json
          line_items: Json
          subtotal: number
          gst_amount: number
          grand_total: number
          gst_type: string
          place_of_supply: string
          terms: string
          notes: string
          company_settings_snapshot: Json
          created_at?: string
          created_by: string
        }
        Update: {
          invoice_id?: string
          invoice_number?: string
          docket_id?: string
          customer_id?: string
          invoice_date?: string
          due_date?: string
          billed_to?: Json
          line_items?: Json
          subtotal?: number
          gst_amount?: number
          grand_total?: number
          gst_type?: string
          place_of_supply?: string
          terms?: string
          notes?: string
          company_settings_snapshot?: Json
          created_at?: string
          created_by?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          name: string
          role: string
        }
        Insert: {
          id: string
          email?: string | null
          name: string
          role?: string
        }
        Update: {
          id?: string
          email?: string | null
          name?: string
          role?: string
        }
      }
      suppliers: {
        Row: {
          contact_number: string
          contact_person: string
          id: string
          name: string
        }
        Insert: {
          contact_number: string
          contact_person: string
          id: string
          name: string
        }
        Update: {
          contact_number?: string
          contact_person?: string
          id?: string
          name?: string
        }
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