import { Agent, DocketDeletionLog, Supplier } from "./types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
        Row: {
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
        Insert: Partial<{
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
        }>;
        Update: Partial<{
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
