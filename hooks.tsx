import React, { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import { AuthUser, Docket, DocketDeletionLog, CompanySettings, Supplier, Agent } from './types';
import { supabase, supabaseService } from './services';
import { DEFAULT_COMPANY_SETTINGS } from './constants';
import { Json } from './database.types';

// --- Auth Hook ---
interface AuthContextType {
  currentUser: AuthUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  logout: () => void;
  sendPasswordReset: (email: string) => Promise<any>;
  updatePassword: (pass: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This listener is the single source of truth for the user's auth state.
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
            const profile = await supabaseService.getUserProfile(session.user);
            setCurrentUser(profile);
        } else {
            setCurrentUser(null);
        }
        setLoading(false);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    const { user, error } = await supabaseService.signInWithPassword(email, pass);
    if (error) {
        setLoading(false);
        throw new Error(error);
    }
    // The onAuthStateChange listener will handle setting the user state.
    setLoading(false);
  };

  const logout = async () => {
    await supabaseService.signOut();
    setCurrentUser(null);
  };
  
  const sendPasswordReset = async (email: string) => {
    const { error } = await supabaseService.sendPasswordResetEmail(email);
    if (error) throw new Error(error);
  };

  const updatePassword = async (pass: string) => {
     const { error } = await supabaseService.updateUserPassword(pass);
     if (error) throw new Error(error);
  };

  const value = { currentUser, loading, login, logout, sendPasswordReset, updatePassword };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// --- Dockets Hook ---
export const useDockets = () => {
  const [dockets, setDockets] = useState<Docket[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [deletionLog, setDeletionLog] = useState<DocketDeletionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
        setLoading(true);
        const fetchData = async () => {
            try {
                const [docketsRes, suppliersRes, agentsRes, profilesRes, deletionLogRes] = await Promise.all([
                    supabase.from('dockets').select('*').order('created_at', { ascending: false }),
                    supabase.from('suppliers').select('*'),
                    supabase.from('agents').select('*'),
                    supabase.from('profiles').select('id, name, email, role'),
                    supabase.from('deletion_log').select('*')
                ]);

                if (docketsRes.error) throw docketsRes.error;
                if (docketsRes.data) setDockets(docketsRes.data as unknown as Docket[]);

                if (suppliersRes.error) throw suppliersRes.error;
                if(suppliersRes.data) setSuppliers(suppliersRes.data);

                if (agentsRes.error) throw agentsRes.error;
                if(agentsRes.data) setAgents(agentsRes.data);

                if (profilesRes.error) throw profilesRes.error;
                if(profilesRes.data) setUsers(profilesRes.data as AuthUser[]);

                if (deletionLogRes.error) throw deletionLogRes.error;
                if(deletionLogRes.data) setDeletionLog(deletionLogRes.data);

            } catch (error: any) {
                console.error("Error fetching data from Supabase:", error.message);
                alert("Could not load data from the database. Please check your connection or contact support.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    } else {
        // Clear data on logout
        setDockets([]);
        setSuppliers([]);
        setAgents([]);
        setUsers([]);
        setDeletionLog([]);
    }
  }, [currentUser]);

  const getDocketById = useCallback((id: string) => dockets.find(d => d.id === id), [dockets]);
  
  const createSearchTags = (docket: Omit<Docket, 'searchTags' | 'id' | 'createdAt' | 'updatedAt'>): string[] => {
    const tags = new Set<string>();
    tags.add(docket.client.name.toLowerCase());
    tags.add(docket.client.contactInfo.toLowerCase());
    docket.passengers.forEach(p => tags.add(p.fullName.toLowerCase()));
    docket.itinerary.flights.forEach(f => {
      tags.add(f.airline.toLowerCase());
      tags.add(f.departureAirport.toLowerCase());
      tags.add(f.arrivalAirport.toLowerCase());
    });
    docket.itinerary.hotels.forEach(h => tags.add(h.name.toLowerCase()));
    docket.itinerary.excursions.forEach(e => tags.add(e.name.toLowerCase()));
    docket.itinerary.transfers.forEach(t => tags.add(t.provider.toLowerCase()));
    const agent = agents.find(a => a.id === docket.agentId);
    if(agent) tags.add(agent.name.toLowerCase());
    return Array.from(tags);
  };

  const saveDocket = useCallback(async (docketData: Omit<Docket, 'id' | 'searchTags' | 'createdAt' | 'updatedAt'>, id?: string) => {
    setLoading(true);
    try {
        let docketToSave: Partial<Docket>;
        if (id) {
            docketToSave = { ...docketData, id, updatedAt: new Date().toISOString(), searchTags: createSearchTags(docketData) };
        } else {
            if (!currentUser) throw new Error("User must be logged in to create a docket.");
            docketToSave = { ...docketData, id: `DOCKET-${Date.now()}`, createdBy: currentUser.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), searchTags: createSearchTags(docketData) };
        }
        
        const { data, error } = await supabase.from('dockets').upsert(docketToSave as any).select().single();
        
        if (error) throw error;

        setDockets(prev => {
            const index = prev.findIndex(d => d.id === data.id);
            if (index > -1) {
                const newDockets = [...prev];
                newDockets[index] = data as unknown as Docket;
                return newDockets;
            }
            return [data as unknown as Docket, ...prev];
        });
        return data.id;
    } catch (error: any) {
        console.error("Error saving docket:", error.message);
        throw error;
    } finally {
        setLoading(false);
    }
  }, [agents, currentUser]);

  const deleteDocket = useCallback(async (id: string, reason: string) => {
    setLoading(true);
    const docketToDelete = dockets.find(d => d.id === id);
    if (docketToDelete && currentUser) {
      const logEntry: Omit<DocketDeletionLog, 'id'> = { docketId: id, clientName: docketToDelete.client.name, deletedBy: currentUser.email || 'Unknown User', deletedAt: new Date().toISOString(), reason };
      const { error: logError } = await supabase.from('deletion_log').insert(logEntry);
      if (logError) { setLoading(false); throw logError; }
      
      const { error: deleteError } = await supabase.from('dockets').delete().eq('id', id);
      if (deleteError) { setLoading(false); throw deleteError; }

      setDockets(prev => prev.filter(d => d.id !== id));
      const newLogEntry = await supabase.from('deletion_log').select('*').eq('docketId', id).single();
      if(newLogEntry.data) setDeletionLog(prev => [newLogEntry.data, ...prev]);
    }
    setLoading(false);
  }, [dockets, currentUser]);

  const saveSupplier = useCallback(async (supplier: Omit<Supplier, 'id'>) => {
    const newSupplier = { ...supplier, id: `SUP-${Date.now()}` };
    const { data, error } = await supabase.from('suppliers').insert(newSupplier).select().single();
    if (error) throw error;
    if(data) setSuppliers(prev => [...prev, data]);
  }, []);

  const saveAgent = useCallback(async (agent: Omit<Agent, 'id'>) => {
    const newAgent = { ...agent, id: `AGENT-${Date.now()}` };
    const { data, error } = await supabase.from('agents').insert(newAgent).select().single();
    if (error) throw error;
    if(data) setAgents(prev => [...prev, data]);
  }, []);

  const updateUserRole = useCallback(async (userId: string, role: 'admin' | 'user') => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (error) {
        console.error("Error updating user role:", error);
        alert("Failed to update user role.");
        return;
    }
    setUsers(prevUsers => prevUsers.map(u => u.id === userId ? { ...u, role } : u));
    
    if (currentUser && currentUser.id === userId) {
        alert("Your role has been updated. The changes will be fully applied on your next login.");
    }
  }, [currentUser]);

  return { dockets, getDocketById, saveDocket, deleteDocket, suppliers, saveSupplier, agents, saveAgent, users, updateUserRole, deletionLog, loading };
};

// --- Company Settings Hook ---
export const useCompanySettings = () => {
    const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);

    useEffect(() => {
        const fetchSettings = async () => {
            const { data, error } = await supabase
                .from('company_settings')
                .select('settings')
                .eq('id', 1)
                .single();
            
            if (data && data.settings) {
                setSettings(data.settings as CompanySettings);
            } else if (error && error.code === 'PGRST116') { // 'PGRST116' means no rows returned
                // If no settings exist, insert the default ones
                const { error: insertError } = await supabase
                    .from('company_settings')
                    .insert({ id: 1, settings: DEFAULT_COMPANY_SETTINGS as unknown as Json });
                if(insertError) console.error("Could not insert default company settings:", insertError);
            } else if (error) {
                console.error("Error fetching company settings:", error);
            }
        };
        fetchSettings();
    }, []);

    const updateSettings = async (newSettings: Partial<CompanySettings>) => {
        const updatedSettings = { ...settings, ...newSettings };
        const { error } = await supabase
            .from('company_settings')
            .upsert({ id: 1, settings: updatedSettings as unknown as Json });
        
        if (error) {
            console.error("Error saving company settings:", error);
            alert("Failed to save settings.");
        } else {
            setSettings(updatedSettings);
        }
    };

    const getNextInvoiceNumber = async () => {
        // In a high-concurrency environment, this should be an RPC call to a Postgres function
        // for an atomic update. For this CRM's likely usage, this is acceptable.
        const nextNum = settings.lastInvoiceNumber + 1;
        await updateSettings({ lastInvoiceNumber: nextNum });
        return nextNum;
    };
    
    return { settings, updateSettings, getNextInvoiceNumber };
};
