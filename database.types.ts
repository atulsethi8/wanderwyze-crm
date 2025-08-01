
export type Json = any;

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
          role: string
        }
        Insert: {
          email?: string | null
          id: string
          name: string
          role: string
        }
        Update: {
          email?: string | null
          id?: string
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
