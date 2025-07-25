// This file is simplified to use `any` for JSONB columns. This is a workaround
// for a known issue where complex recursive types (like a fully-typed Json object)
// can cause the TypeScript compiler to hang when used with the Supabase client,
// leading to an infinite loading spinner on app start. Using `any` resolves this
// performance bottleneck.

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string;
          name: string;
          contact_info: string;
        };
        Insert: {
          id: string;
          name: string;
          contact_info: string;
        };
        Update: {
          id?: string;
          name?: string;
          contact_info?: string;
        };
      };
      company_settings: {
        Row: {
          id: number;
          settings: any; // Changed from Json to any
        };
        Insert: {
          id: number;
          settings: any; // Changed from Json to any
        };
        Update: {
          id?: number;
          settings?: any; // Changed from Json to any
        };
      };
      deletion_log: {
        Row: {
          id: number;
          docket_id: string;
          client_name: string;
          deleted_by: string;
          deleted_at: string;
          reason: string;
        };
        Insert: {
          id?: number; // DB should auto-increment
          docket_id: string;
          client_name: string;
          deleted_by: string;
          deleted_at: string;
          reason: string;
        };
        Update: {
          id?: number;
          docket_id?: string;
          client_name?: string;
          deleted_by?: string;
          deleted_at?: string;
          reason?: string;
        };
      };
      dockets: {
        Row: {
            id: string;
            client: any; // Changed from Json to any
            status: string;
            tag: string;
            agent_id: string | null;
            passengers: any; // Changed from Json to any
            itinerary: any; // Changed from Json to any
            files: any; // Changed from Json to any
            comments: any; // Changed from Json to any
            payments: any; // Changed from Json to any
            invoices: any; // Changed from Json to any
            search_tags: string[];
            created_by: string;
            created_at: string;
            updated_at: string;
        };
        Insert: {
            id: string;
            client: any; // Changed from Json to any
            status: string;
            tag: string;
            agent_id: string | null;
            passengers: any; // Changed from Json to any
            itinerary: any; // Changed from Json to any
            files: any; // Changed from Json to any
            comments: any; // Changed from Json to any
            payments: any; // Changed from Json to any
            invoices: any; // Changed from Json to any
            search_tags: string[];
            created_by: string;
            created_at: string;
            updated_at: string;
        };
        Update: {
            id?: string;
            client?: any; // Changed from Json to any
            status?: string;
            tag?: string;
            agent_id?: string | null;
            passengers?: any; // Changed from Json to any
            itinerary?: any; // Changed from Json to any
            files?: any; // Changed from Json to any
            comments?: any; // Changed from Json to any
            payments?: any; // Changed from Json to any
            invoices?: any; // Changed from Json to any
            search_tags?: string[];
            created_by?: string;
            created_at?: string;
            updated_at?: string;
        };
      };
      profiles: {
        Row: {
            id: string;
            role: string;
            name: string;
            email: string | null;
        };
        Insert: {
            id: string;
            role?: string;
            name?: string;
            email?: string | null;
        };
        Update: {
            id?: string;
            role?: string;
            name?: string;
            email?: string | null;
        };
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          contact_person: string;
          contact_number: string;
        };
        Insert: {
          id: string;
          name: string;
          contact_person: string;
          contact_number: string;
        };
        Update: {
          id?: string;
          name?: string;
          contact_person?: string;
          contact_number?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
