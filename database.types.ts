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
      profiles: {
        Row: {
          email: string | null
          id: string
          name: string
          role: "admin" | "user"
        }
        Insert: {
          email?: string | null
          id: string
          name: string
          role: "admin" | "user"
        }
        Update: {
          email?: string | null
          id?: string
          name?: string
          role?: "admin" | "user"
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
      customer_master: {
        Row: {
          address: string
          created_at: string
          customer_id: string
          email: string | null
          gst_number: string
          name: string
          phone: string | null
        }
        Insert: {
          address: string
          created_at?: string
          customer_id?: string
          email?: string | null
          gst_number: string
          name: string
          phone?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          customer_id?: string
          email?: string | null
          gst_number?: string
          name?: string
          phone?: string | null
        }
      }
      invoice_master: {
        Row: {
          invoice_id: string
          invoice_number: string
          docket_id: string | null
          customer_id: string | null
          invoice_date: string
          due_date: string
          billed_to: Json
          line_items: Json
          subtotal: number
          gst_amount: number
          grand_total: number
          gst_type: string
          place_of_supply: string | null
          terms: string
          notes: string | null
          company_settings_snapshot: Json
          created_at: string
          created_by: string | null
        }
        Insert: {
          invoice_id?: string
          invoice_number: string
          docket_id?: string | null
          customer_id?: string | null
          invoice_date: string
          due_date: string
          billed_to: Json
          line_items: Json
          subtotal: number
          gst_amount: number
          grand_total: number
          gst_type: string
          place_of_supply?: string | null
          terms: string
          notes?: string | null
          company_settings_snapshot: Json
          created_at?: string
          created_by?: string | null
        }
        Update: {
          invoice_id?: string
          invoice_number?: string
          docket_id?: string | null
          customer_id?: string | null
          invoice_date?: string
          due_date?: string
          billed_to?: Json
          line_items?: Json
          subtotal?: number
          gst_amount?: number
          grand_total?: number
          gst_type?: string
          place_of_supply?: string | null
          terms?: string
          notes?: string | null
          company_settings_snapshot?: Json
          created_at?: string
          created_by?: string | null
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