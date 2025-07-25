import {
    Agent,
    DocketDeletionLog,
    Supplier
} from "./types";

export type Json = any;

// New type for the dockets table row to avoid deep type instantiation errors.
// It uses `Json` for columns that are likely `jsonb` in the database.
export type DocketRow = {
    id: string;
    client: Json;
    status: string;
    tag: string;
    agentId: string | null;
    passengers: Json;
    itinerary: Json;
    files: Json;
    comments: Json;
    payments: Json;
    invoices: Json;
    searchTags: string[];
    createdBy: string;
    createdAt: string;
    updatedAt: string;
};

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: Agent;
        Insert: Agent;
        Update: Partial<Agent>;
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
        Row: DocketDeletionLog;
        Insert: Omit<DocketDeletionLog, "id">;
        Update: Partial<DocketDeletionLog>;
      };
      dockets: {
        Row: DocketRow;
        // Using DocketRow, which is simplified with Json properties, for Insert and Update
        // to prevent "type instantiation excessively deep" errors that occur with the full Docket type,
        // while still providing better type safety than just `Json`.
        Insert: DocketRow;
        Update: Partial<DocketRow>;
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
          role: "admin" | "user";
          name: string;
          email: string | null;
        }>;
      };
      suppliers: {
        Row: Supplier;
        Insert: Supplier;
        Update: Partial<Supplier>;
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