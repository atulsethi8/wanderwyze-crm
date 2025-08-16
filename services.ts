
// This file no longer needs the vite client reference.
// It caused confusion as the environment doesn't seem to be a standard Vite setup.

import { createClient, type User } from "@supabase/supabase-js";
import { GoogleGenAI, Type } from "@google/genai";
import { AuthUser } from "./types";
import { Database } from './database.types';

// ===================================================================================
// ENVIRONMENT VARIABLE CONFIGURATION
// ===================================================================================
//
// This application is configured to use environment variables for API keys.
// These are expected to be injected by the build/deployment environment.
//
// For Supabase: process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY
// For Gemini: process.env.API_KEY
//
// ===================================================================================

// IMPORTANT: Use direct references to process.env.* so Vite can statically replace
// these at build time.
const supabaseUrl = process.env.VITE_SUPABASE_URL as unknown as string | undefined;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY as unknown as string | undefined;
// The Gemini API key MUST be API_KEY as per coding guidelines.
const geminiApiKey = process.env.API_KEY as unknown as string | undefined;


// This flag checks if ALL required keys have been configured.
// The App.tsx component will use this to show a full-screen error if it's true.
export const usingDefaultKeys = !supabaseUrl || !supabaseAnonKey || !geminiApiKey;

// We initialize Supabase client here.
// To prevent the app from crashing on startup if keys are missing, we provide
// dummy placeholder values. The `usingDefaultKeys` flag above will be true,
// and the <App> component will show a config error screen instead of
// ever trying to use this dummy client.
export const supabase = createClient<Database>(
    supabaseUrl || "http://localhost:54321", 
    supabaseAnonKey || "dummy-key",
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
);


const ADMIN_EMAILS = ['admin@wanderwyze.com', 'a4atul@gmail.com', 'atul@wanderwyze.com', 'ravi@wanderwyze.com'];

const getUserProfile = async (user: User): Promise<AuthUser | null> => {
    try {
        // 1. Attempt to fetch the user's profile
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role, name, email')
            .eq('id', user.id)
            .single();

        // If a profile exists, return it
        if (profile) {
            const isSuperAdmin = user.email ? ADMIN_EMAILS.includes(user.email) : false;
            const determinedRole = isSuperAdmin ? 'admin' : profile.role;
            return { id: user.id, name: profile.name || user.id, email: user.email ?? undefined, role: determinedRole };
        }

        // 2. If no profile exists (PGRST116: "No rows found"), create one
        if (error && error.code === 'PGRST116') {
            console.log('No profile found for user, creating one...');

            const isSuperAdmin = user.email ? ADMIN_EMAILS.includes(user.email) : false;
            const newUserRole: 'admin' | 'user' = isSuperAdmin ? 'admin' : 'user';

            const newProfileData = {
                id: user.id,
                email: user.email ?? null,
                name: user.email || user.id, // name is required and cannot be null
                role: newUserRole,
            };

            const { error: insertError } = await supabase.from('profiles').insert([newProfileData]);

            if (insertError) {
                console.error("Fatal error: Could not create user profile on-the-fly.", insertError);
                throw insertError;
            }

            console.log('Profile created successfully.');
            return { id: user.id, name: newProfileData.name, email: newProfileData.email ?? undefined, role: newProfileData.role };
        }

        // 3. If there was another type of error, throw it
        if (error) {
            throw error;
        }

        return null;

    } catch (e) {
        console.error("Exception in getUserProfile:", e);
        return null;
    }
};


// --- SUPABASE AUTH SERVICE (v2 Syntax) ---
export const supabaseService = {
  async signInWithPassword(email: string, password?: string): Promise<{ user: AuthUser | null; error: string | null }> {
    if (!password) return { user: null, error: 'Password is required.' };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { user: null, error: error.message };
    if (!data.user) return { user: null, error: 'Login failed, no user returned.' };
    
    // Ensure session is persisted to localStorage
    if (data.session?.access_token && data.session?.refresh_token) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });
    }
    
    // Return a minimal user immediately for UI, determine admin by email
    const isSuperAdmin = data.user.email ? ADMIN_EMAILS.includes(data.user.email) : false;
    const immediateUser: AuthUser = {
      id: data.user.id,
      name: data.user.email || data.user.id,
      email: data.user.email ?? undefined,
      role: isSuperAdmin ? 'admin' : 'user'
    };

    // Best-effort: fetch/create full profile in background; do not block login
    getUserProfile(data.user).catch(() => {});

    return { user: immediateUser, error: null };
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error signing out:', error);
  },

  async getSession(): Promise<{ user: AuthUser | null }> {
     const { data: { session }, error } = await supabase.auth.getSession();
     if (error || !session) {
         return { user: null };
     }
     try {
       const userProfile = await getUserProfile(session.user);
       if (userProfile) return { user: userProfile };
     } catch {}
     // Fallback minimal profile
     return {
       user: {
         id: session.user.id,
         name: session.user.email || session.user.id,
         email: session.user.email ?? undefined,
         role: 'user'
       }
     };
  },
  
  async sendPasswordResetEmail(email: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/#/reset-password`,
    });
    return { error: error ? error.message : null };
  },

  async updateUserPassword(password: string): Promise<{ error: string | null }> {
    const { data, error } = await supabase.auth.updateUser({ password });
    return { error: error ? error.message : null };
  },

  getUserProfile,

  // Customer Master
  async listCustomers(): Promise<{ data: import('./types').Customer[]; error: string | null }> {
    const { data, error } = await supabase.from('customer_master').select('*').order('created_at', { ascending: false });
    return { data: (data || []) as unknown as import('./types').Customer[], error: error ? error.message : null };
  },
  async addCustomer(customer: Omit<import('./types').Customer, 'customer_id' | 'created_at'>): Promise<{ data: import('./types').Customer | null; error: string | null }> {
    const payload = { ...customer } as any;
    const { data, error } = await supabase.from('customer_master').insert([payload]).select().single();
    return { data: (data || null) as unknown as import('./types').Customer | null, error: error ? error.message : null };
  },
  async updateCustomer(customerId: string, updates: Partial<import('./types').Customer>): Promise<{ data: import('./types').Customer | null; error: string | null }> {
    const payload = { ...updates, updated_at: new Date().toISOString() } as any;
    const { data, error } = await supabase.from('customer_master').update(payload).eq('customer_id', customerId).select().single();
    return { data: (data || null) as unknown as import('./types').Customer | null, error: error ? error.message : null };
  },
  async deleteCustomer(customerId: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('customer_master').delete().eq('customer_id', customerId);
    return { error: error ? error.message : null };
  },
  async searchCustomers(term: string): Promise<{ data: import('./types').Customer[]; error: string | null }> {
    const like = `%${term}%`;
    const { data, error } = await supabase
      .from('customer_master')
      .select('*')
      .or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .order('created_at', { ascending: false });
    return { data: (data || []) as unknown as import('./types').Customer[], error: error ? error.message : null };
  },

  // Invoice Master
  async addInvoice(invoice: import('./types').Invoice, userId: string): Promise<{ data: any; error: string | null }> {
    const payload = {
      invoice_number: invoice.invoiceNumber,
      docket_id: invoice.docketId,
      customer_id: invoice.customerId,
      invoice_date: invoice.date,
      due_date: invoice.dueDate,
      billed_to: invoice.billedTo,
      line_items: invoice.lineItems,
      subtotal: invoice.subtotal,
      gst_amount: invoice.gstAmount,
      grand_total: invoice.grandTotal,
      gst_type: invoice.gstType,
      place_of_supply: invoice.placeOfSupply,
      terms: invoice.terms,
      notes: invoice.notes,
      company_settings_snapshot: invoice.companySettings,
      created_by: userId
    };
    
    const { data, error } = await supabase.from('invoice_master').insert([payload]).select().single();
    return { data: data || null, error: error ? error.message : null };
  },
  async getInvoicesByDocket(docketId: string): Promise<{ data: any[]; error: string | null }> {
    const { data, error } = await supabase
      .from('invoice_master')
      .select('*')
      .eq('docket_id', docketId)
      .order('created_at', { ascending: false });
    return { data: (data || []) as any[], error: error ? error.message : null };
  },
  async getInvoiceById(invoiceId: string): Promise<{ data: any; error: string | null }> {
    const { data, error } = await supabase
      .from('invoice_master')
      .select('*')
      .eq('invoice_id', invoiceId)
      .single();
    return { data: data || null, error: error ? error.message : null };
  }
};


let ai: GoogleGenAI | null = null;

const initializeAi = (): GoogleGenAI => {
    if (!ai) {
        // The `usingDefaultKeys` check in App.tsx ensures the app doesn't run if geminiApiKey is missing.
        // The '!' asserts it's not null here.
        ai = new GoogleGenAI({apiKey: geminiApiKey!});
    }
    return ai;
};


export const geminiService = {
  extractDataFromDocument: async (fileContent: string, mimeType: string, schema: any, promptText: string) => {
      const aiInstance = initializeAi();
      const documentPart = { inlineData: { data: fileContent, mimeType } };
      const textPart = { text: promptText };

      const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, documentPart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
      });

      const jsonText = response.text.trim();
      return JSON.parse(jsonText);
  }
};


export const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
});

export const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(`${dateString}T00:00:00`);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-GB');
    } catch(e) {
        return 'N/A';
    }
};

export function formatDateTimeIST(dateString: string | Date): string {
    try {
        const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
        if (isNaN(date.getTime())) return 'N/A';
        
        return new Intl.DateTimeFormat('en-IN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        }).format(date).replace(/,/g, '');
    } catch(e) {
        return 'N/A';
    }
}

export const toYYYYMMDD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};


export function getNumberOfNights(checkIn: string, checkOut: string): number {
    if (!checkIn || !checkOut) return 0;
    try {
        const diffTime = new Date(checkOut).getTime() - new Date(checkIn).getTime();
        if (isNaN(diffTime) || diffTime < 0) return 0;
        const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return nights === 0 && diffTime > 0 ? 1 : nights;
    } catch (e) {
        return 0;
    }
}

export function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

export function amountToWords(amount: number) {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    const num = parseFloat(String(amount || 0)).toFixed(2).split('.');
    const whole = parseInt(num[0]);
    const decimal = parseInt(num[1]);

    function inWords(n: number): string {
        if (n < 0) return '';
        let str = '';
        if (n < 20) {
            str = a[n];
        } else if (n < 100) {
            str = b[Math.floor(n / 10)] + a[n % 10];
        } else if (n < 1000) {
            str = a[Math.floor(n / 100)] + 'hundred ' + inWords(n % 100);
        } else if (n < 100000) {
            str = inWords(Math.floor(n / 1000)) + 'thousand ' + inWords(n % 1000);
        } else if (n < 10000000) {
            str = inWords(Math.floor(n / 100000)) + 'lakh ' + inWords(n % 100000);
        } else {
            str = inWords(Math.floor(n / 10000000)) + 'crore ' + inWords(n % 10000000);
        }
        return str;
    }
    
    let words = '';
    if (whole > 0) {
        words += inWords(whole) + 'rupees ';
    }

    if (decimal > 0) {
        if (words) {
            words += 'and ';
        }
        words += inWords(decimal) + 'paise ';
    }
    
    if (!words) {
        return 'Zero Rupees';
    }
    
    return words.replace(/\s+/g, ' ').trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
