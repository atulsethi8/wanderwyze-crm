// The complex, recursive Json type can cause the Supabase client to silently
// fail on initialization. Replacing it with `any` is a standard, effective workaround.
export type Json = any;

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string;
          name: string;
          contactInfo: string;
        };
        Insert: {
          id: string;
          name: string;
          contactInfo: string;
        };
        Update: Partial<{
          id: string;
          name: string;
          contactInfo: string;
        }>;
      };
      company_settings: {
        Row: {
          id: number;
          settings: Json;
        };
        Insert: {
          id: number;
          settings: Json;
        };
        Update: Partial<{
          id: number;
          settings: Json;
        }>;
      };
      deletion_log: {
        Row: {
          id: number;
          docketId: string;
          clientName: string;
          deletedBy: string;
          deletedAt: string;
          reason: string;
        };
        Insert: {
          docketId: string;
          clientName: string;
          deletedBy: string;
          deletedAt: string;
          reason: string;
        };
        Update: Partial<{
          id: number;
          docketId: string;
          clientName: string;
          deletedBy: string;
          deletedAt: string;
          reason: string;
        }>;
      };
      dockets: {
        Row: {
            id: string;
            client: Json;
            status: string;
            tag: string;
            agent_id: string | null;
            passengers: Json;
            itinerary: Json;
            files: Json;
            comments: Json;
            payments: Json;
            invoices: Json;
            search_tags: string[];
            created_by: string;
            created_at: string;
            updated_at: string;
        };
        Insert: Partial<{
            id: string;
            client: Json;
            status: string;
            tag: string;
            agent_id: string | null;
            passengers: Json;
            itinerary: Json;
            files: Json;
            comments: Json;
            payments: Json;
            invoices: Json;
            search_tags: string[];
            created_by: string;
            created_at: string;
            updated_at: string;
        }>;
        Update: Partial<{
            id: string;
            client: Json;
            status: string;
            tag: string;
            agent_id: string | null;
            passengers: Json;
            itinerary: Json;
            files: Json;
            comments: Json;
            payments: Json;
            invoices: Json;
            search_tags: string[];
            created_by: string;
            created_at: string;
            updated_at: string;
        }>;
      };
      profiles: {
        Row: {
            id: string;
            role: "admin" | "user";
            name: string;
            email: string | null;
        };
        Insert: {
            id: string;
            role?: "admin" | "user";
            name?: string;
            email?: string | null;
        };
        Update: Partial<{
            id: string;
            role: "admin" | "user";
            name: string;
            email: string | null;
        }>;
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          contactPerson: string;
          contactNumber: string;
        };
        Insert: {
          id: string;
          name: string;
          contactPerson: string;
          contactNumber: string;
        };
        Update: Partial<{
          id: string;
          name: string;
          contactPerson: string;
          contactNumber: string;
        }>;
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
