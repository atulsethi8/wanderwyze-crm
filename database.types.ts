
// The complex, recursive Json type was causing the Supabase client to silently
// fail on initialization, leading to an infinite loading spinner.
// Replacing it with `any` is a standard, effective workaround for this issue.
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

// --- Local type definitions to break import cycles and fix type depth issues ---
// These types are identical to their counterparts in `types.ts` but are defined
// here to prevent TypeScript from entering a deep type-checking spiral.
export interface Agent {
  id: string;
  name: string;
  contactInfo: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  contactNumber: string;
}

export interface DocketDeletionLog {
  id: number;
  docketId: string;
  clientName: string;
  deletedBy: string;
  deletedAt: string;
  reason: string;
}

// --- Explicit type definitions to avoid deep type instantiation issues ---

// By defining these types outside the main Database interface, we simplify the work
// the TypeScript compiler needs to do when resolving the generic types for the Supabase client.

// For `agents` table
type AgentUpdate = Partial<Agent>;

// For `company_settings` table
type CompanySettingsRow = { id: number; settings: Json; };
type CompanySettingsUpdate = Partial<CompanySettingsRow>;

// For `deletion_log` table
type DocketDeletionLogInsert = Omit<DocketDeletionLog, 'id'>;
type DocketDeletionLogUpdate = Partial<DocketDeletionLog>;

// For `dockets` table
type DocketDatabaseRowUpdate = Partial<DocketDatabaseRow>;

// For `profiles` table
type ProfileUpdate = Partial<Profile>;

// For `suppliers` table
type SupplierUpdate = Partial<Supplier>;


export interface Database {
  public: {
    Tables: {
      agents: {
        Row: Agent;
        Insert: Agent; // In hooks.tsx, `saveAgent` creates the ID before inserting.
        Update: AgentUpdate;
      };
      company_settings: {
        Row: CompanySettingsRow;
        Insert: CompanySettingsRow;
        Update: CompanySettingsUpdate;
      };
      deletion_log: {
        Row: DocketDeletionLog;
        Insert: DocketDeletionLogInsert; // `id` is a serial key, so it's omitted on insert.
        Update: DocketDeletionLogUpdate;
      };
      dockets: {
        Row: DocketDatabaseRow;
        Insert: DocketDatabaseRow; // `saveDocket` uses upsert, providing the full row.
        Update: DocketDatabaseRowUpdate;
      };
      profiles: {
        Row: Profile;
        Insert: Profile;
        Update: ProfileUpdate;
      };
      suppliers: {
        Row: Supplier;
        Insert: Supplier; // In hooks.tsx, `saveSupplier` creates the ID before inserting.
        Update: SupplierUpdate;
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
