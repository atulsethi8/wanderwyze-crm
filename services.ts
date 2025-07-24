import { createClient, User } from "@supabase/supabase-js";
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { AuthUser, Flight, Hotel, Passenger } from "./types";
import { Database } from './database.types';

// --- SUPABASE CLIENT SETUP ---
// IMPORTANT: Replace these placeholder values with your actual Supabase URL and Anon Key.
// You can get these from your Supabase project's "Project Settings" > "API" section.
const supabaseUrl = "https://htoipoewypnertovrzbi.supabase.co"; // <--- REPLACE THIS STRING
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0b2lwb2V3eXBuZXJ0b3ZyemJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0OTMwNjEsImV4cCI6MjA2ODA2OTA2MX0.fHYI-2WmNj2hWrvkj8OhvT46vogx5C5C9zxKjxSXyX4"; // <--- REPLACE THIS STRING

if (supabaseUrl === "YOUR_SUPABASE_URL" || supabaseAnonKey === "YOUR_SUPABASE_ANON_KEY") {
  const errorMsg = "Supabase URL and/or Anon Key are missing. Please open services.ts and replace the placeholder values with your actual credentials.";
  // This check is a critical guide for this development environment.
  alert(errorMsg);
  throw new Error(errorMsg);
}

// The createClient function now uses the Database schema for full type safety.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);


// Helper to get full user profile with role
const getUserProfile = async (user: User): Promise<AuthUser | null> => {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role, name, email')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST1116 is "No rows found", which is okay right after signup
            console.error("Error fetching user profile:", error.message);
            // Fallback for when a profile might not exist yet (e.g., right after signup)
            return { id: user.id, name: user.email || 'New User', email: user.email, role: 'user' };
        }

        if (!profile) {
            return { id: user.id, name: user.email || 'New User', email: user.email, role: 'user' };
        }

        return { id: user.id, name: profile.name || user.email, email: user.email, role: profile.role as 'admin' | 'user' };
    } catch(e) {
        console.error("Exception fetching profile:", e);
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
    
    const userProfile = await getUserProfile(data.user);
    return { user: userProfile, error: null };
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
     const userProfile = await getUserProfile(session.user);
     return { user: userProfile };
  },
  
  async sendPasswordResetEmail(email: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/#/reset-password',
    });
    return { error: error ? error.message : null };
  },

  async updateUserPassword(password: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? error.message : null };
  },

  getUserProfile
};


// --- GEMINI SERVICE ---
const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

export const geminiService = {
  getItinerarySuggestions: async (destination: string, duration: number, interests: string) => {
    const prompt = `Provide itinerary suggestions for a ${duration}-day trip to ${destination} with interests in ${interests}. Return a JSON object.`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hotels: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT, properties: { name: { type: Type.STRING }, checkInDays: { type: Type.INTEGER }, checkOutDays: { type: Type.INTEGER } }
              }
            },
            excursions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT, properties: { name: { type: Type.STRING }, day: { type: Type.INTEGER } }
              }
            }
          }
        }
      }
    });
    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
  },

  extractDataFromDocument: async (fileContent: string, mimeType: string, schema: any, promptText: string) => {
      const documentPart = { inlineData: { data: fileContent, mimeType } };
      const textPart = { text: promptText };

      const response = await ai.models.generateContent({
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


// --- HELPER FUNCTIONS ---

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
        // Handle YYYY-MM-DD strings by ensuring they are parsed as local time, not UTC.
        // Appending T00:00:00 helps achieve this across browsers.
        const date = new Date(`${dateString}T00:00:00`);
        // A simple check for invalid date objects
        if (isNaN(date.getTime())) return 'N/A';
        // Use en-GB locale to get dd/mm/yyyy format
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

    // Ensure amount is a number and handle potential issues
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