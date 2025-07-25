
import {
    Agent,
    DocketDeletionLog,
    Supplier
} from "./types";

export type Json = any;

export type DocketDatabaseRow = {
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

export type Profile = {
    id: string;
    role: "admin" | "user";
    name: string;
    email: string | null;
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
        Insert: Omit<DocketDeletionLog, 'id'>;
        Update: Partial<DocketDeletionLog>;
      };
      dockets: {
        Row: DocketDatabaseRow;
        Insert: DocketDatabaseRow;
        Update: Partial<DocketDatabaseRow>;
      };
      profiles: {
        Row: Profile;
        Insert: Profile;
        Update: Partial<Profile>;
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
