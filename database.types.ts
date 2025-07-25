
import {
    Agent,
    DocketDeletionLog,
    Supplier
} from "./types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
        // The data being inserted/updated is of type `Docket` from the app, which is compatible with `Json` after stringification.
        // We define Insert and Update as `Partial<DocketRow>` to match the `Row` definition.
        Insert: Partial<DocketRow>;
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
