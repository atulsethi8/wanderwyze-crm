

import { createClient, User } from "@supabase/supabase-js";
import { GoogleGenAI, Type } from "@google/genai";
import { AuthUser } from "./types";
import { Database } from './database.types';

// ===================================================================================
// START HERE: ACTION REQUIRED
// ===================================================================================
//
// This application runs directly in the browser and has NO BUILD STEP.
// It CANNOT read environment variables from your hosting provider (like Netlify).
// The advice to use `process.env` or `import.meta.env` will NOT work for this project.
//
// You MUST replace the placeholder values in the CONFIG object below with your
// actual API keys from your Supabase project and Google AI Studio.
//
// ===================================================================================
const CONFIG = {
  // 1. Get this from your Supabase project > Settings > API > Project URL
  SUPABASE_URL: "https://htoipoewypnertovrzbi.supabase.co",

  // 2. Get this from your Supabase project > Settings > API > Project API Keys > anon (public)
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0b2lwb2V3eXBuZXJ0b3ZyemJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0OTMwNjEsImV4cCI6MjA2ODA2OTA2MX0.fHYI-2WmNj2hWrvkj8OhvT46vogx5C5C9zxKjxSXyX4",

  // 3. Get this from Google AI Studio > "Get API key"
  API_KEY: "AIzaSyDdkzkHodaauz8A7M7QyxDa1kzuNz8Bzgk",
};
// ===================================================================================
// END OF CONFIGURATION
// ===================================================================================


// This flag checks if the API keys have been configured.
// The app will show a full-screen error if this is true.
export const usingDefaultKeys = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY || !CONFIG.API_KEY;

const supabaseUrl = CONFIG.SUPABASE_URL;
const supabaseAnonKey = CONFIG.SUPABASE_ANON_KEY;

// This will throw an error immediately if keys are completely missing.
if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = "Supabase URL and/or Anon Key are critically missing. Edit services.ts and fill in the CONFIG object.";
  document.body.innerHTML = `<div style="font-family: sans-serif; padding: 2rem; text-align: center; background-color: #FFFBEB; color: #92400E; border: 1px solid #FBBF24; border-radius: 8px; margin: 2rem;">
    <h1 style="font-size: 1.5rem; font-weight: bold;">Fatal Configuration Error</h1>
    <p style="margin-top: 1rem;">${errorMsg}</p>
  </div>`;
  throw new Error(errorMsg);
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);


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
        redirectTo: `${window.location.origin}/#/reset-password`,
    });
    return { error: error ? error.message : null };
  },

  async updateUserPassword(password: string): Promise<{ error: string | null }> {
    const { data, error } = await supabase.auth.updateUser({ password });
    return { error: error ? error.message : null };
  },

  getUserProfile
};


let ai: GoogleGenAI | null = null;

const initializeAi = (): GoogleGenAI | null => {
    const apiKey = CONFIG.API_KEY;

    if (usingDefaultKeys) {
        console.error("Gemini API Key is missing or is a placeholder. AI features will be disabled.");
        return null;
    }
    
    if (!ai) {
        ai = new GoogleGenAI({apiKey: apiKey});
    }
    return ai;
};


export const geminiService = {
  getItinerarySuggestions: async (destination: string, duration: number, interests: string) => {
    const aiInstance = initializeAi();
    if (!aiInstance) {
        throw new Error("Gemini AI service is not available. Please ensure the API_KEY is configured in services.ts.");
    }
    const prompt = `Provide itinerary suggestions for a ${duration}-day trip to ${destination} with interests in ${interests}. Return a JSON object.`;
    const response = await aiInstance.models.generateContent({
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
      const aiInstance = initializeAi();
      if (!aiInstance) {
        throw new Error("Gemini AI service is not available. Please ensure the API_KEY is configured in services.ts.");
      }
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