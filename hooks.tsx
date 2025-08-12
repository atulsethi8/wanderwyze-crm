



import React, { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import { AuthUser, Docket, DocketDeletionLog, CompanySettings, Supplier, Agent } from './types';
import { supabase, supabaseService } from './services';
import { DEFAULT_COMPANY_SETTINGS } from './constants';
import { Database } from './database.types';

const mapDbDocketToAppDocket = (dbDocket: any): Docket => {
    if (!dbDocket) return dbDocket;
    const { agent_id, search_tags, created_by, created_at, updated_at, ...rest } = dbDocket;
    return {
        ...rest,
        agentId: agent_id,
        searchTags: search_tags,
        createdBy: created_by,
        createdAt: created_at,
        updatedAt: updated_at
    } as Docket;
};

const mapAppDocketToDbDocket = (appDocket: Partial<Docket>): any => {
    if (!appDocket) return appDocket;
    const { agentId, searchTags, createdBy, createdAt, updatedAt, ...rest } = appDocket;
    const dbObject: any = { ...rest };
    if (agentId !== undefined) dbObject.agent_id = agentId;
    if (searchTags !== undefined) dbObject.search_tags = searchTags;
    if (createdBy !== undefined) dbObject.created_by = createdBy;
    if (createdAt !== undefined) dbObject.created_at = createdAt;
    if (updatedAt !== undefined) dbObject.updated_at = updatedAt;
    return dbObject;
};

const mapDbSupplierToAppSupplier = (dbSupplier: any): Supplier => {
    if (!dbSupplier) return dbSupplier;
    const { contact_person, contact_number, ...rest } = dbSupplier;
    return { ...rest, contactPerson: contact_person, contactNumber: contact_number };
};

const mapDbAgentToAppAgent = (dbAgent: any): Agent => {
    if (!dbAgent) return dbAgent;
    const { contact_info, ...rest } = dbAgent;
    return { ...rest, contactInfo: contact_info };
};


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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Fetch initial session to avoid hanging spinner in environments with no prior session
    const init = async () => {
      try {
        const timeout = new Promise<{ user: AuthUser | null }>((resolve) => setTimeout(() => resolve({ user: null }), 4000));
        const sessionPromise = supabaseService.getSession();
        const { user } = await Promise.race([sessionPromise, timeout]);
        if (!isMounted) return;
        setCurrentUser(user);
      } catch (error) {
        console.error('Error getting initial session:', error);
        if (!isMounted) return;
        setCurrentUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();

    // Subscribe for subsequent auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
        try {
            if (session?.user) {
                const profile = await supabaseService.getUserProfile(session.user);
                setCurrentUser(profile);
            }
        } catch (error) {
            console.error("Error in onAuthStateChange handler:", error);
        }
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const timeoutPromise = new Promise<{ user: any; error: string | null }>((_, reject) => {
        setTimeout(() => reject(new Error('Login request timed out. Please check your network and environment configuration.')), 10000);
      });
      const signInPromise = supabaseService.signInWithPassword(email, pass);
      const { user, error } = await Promise.race([signInPromise, timeoutPromise]) as { user: any; error: string | null };
      if (error) {
        throw new Error(error);
      }
      if (user) {
        setCurrentUser(user);
      }
    } finally {
      setLoading(false);
    }
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
            if (!currentUser) return; // Add a guard clause for safety

            try {
                // Base queries that all users need
                const basePromises = [
                    supabase.from('dockets').select('*').order('created_at', { ascending: false }),
                    supabase.from('suppliers').select('*'),
                    supabase.from('agents').select('*'),
                    supabase.from('profiles').select('id, name, email, role')
                ];

                if (currentUser.role === 'admin') {
                    // --- ADMIN DATA FETCHING ---
                    // Admins can fetch everything, including the deletion log
                    const adminPromises = [
                        ...basePromises,
                        supabase.from('deletion_log').select('*')
                    ];

                    const [docketsRes, suppliersRes, agentsRes, profilesRes, deletionLogRes] = await Promise.all(adminPromises);

                    // Set state for admin-specific data
                    if (deletionLogRes.error) throw deletionLogRes.error;
                    if(deletionLogRes.data) {
                        const mappedLogs = deletionLogRes.data.map(log => ({
                            id: log.id,
                            docketId: log.docket_id,
                            clientName: log.client_name,
                            deletedBy: log.deleted_by,
                            deletedAt: log.deleted_at,
                            reason: log.reason
                        }));
                        setDeletionLog(mappedLogs);
                    }

                    // Set state for other responses
                    if (docketsRes.error) throw docketsRes.error;
                    if (docketsRes.data) setDockets(docketsRes.data.map(mapDbDocketToAppDocket));

                    if (suppliersRes.error) throw suppliersRes.error;
                    if (suppliersRes.data) setSuppliers(suppliersRes.data.map(mapDbSupplierToAppSupplier));

                    if (agentsRes.error) throw agentsRes.error;
                    if (agentsRes.data) setAgents(agentsRes.data.map(mapDbAgentToAppAgent));

                    if (profilesRes.error) throw profilesRes.error;
                    if (profilesRes.data) setUsers(profilesRes.data as AuthUser[]);

                } else {
                    // --- REGULAR USER DATA FETCHING ---
                    // Regular users fetch everything EXCEPT the deletion log
                    const [docketsRes, suppliersRes, agentsRes, profilesRes] = await Promise.all(basePromises);

                    // Set the deletion log to empty for non-admins
                    setDeletionLog([]);

                    // Set state for other responses
                    if (docketsRes.error) throw docketsRes.error;
                    if (docketsRes.data) setDockets(docketsRes.data.map(mapDbDocketToAppDocket));

                    if (suppliersRes.error) throw suppliersRes.error;
                    if (suppliersRes.data) setSuppliers(suppliersRes.data.map(mapDbSupplierToAppSupplier));

                    if (agentsRes.error) throw agentsRes.error;
                    if (agentsRes.data) setAgents(agentsRes.data.map(mapDbAgentToAppAgent));

                    if (profilesRes.error) throw profilesRes.error;
                    if (profilesRes.data) setUsers(profilesRes.data as AuthUser[]);
                }

            } catch (error: any) {
                console.error("Error fetching data from Supabase:", error.message);
                alert("Could not load data from the database. Please check your connection or contact support.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    } else {
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
        
        const dbObject = mapAppDocketToDbDocket(docketToSave);
        
        const { data, error } = await supabase.from('dockets').upsert(dbObject).select().single();
        
        if (error) throw error;

        const returnedDocket = mapDbDocketToAppDocket(data);

        setDockets(prev => {
            const index = prev.findIndex(d => d.id === returnedDocket.id);
            if (index > -1) {
                const newDockets = [...prev];
                newDockets[index] = returnedDocket;
                return newDockets;
            }
            return [returnedDocket, ...prev];
        });
        return returnedDocket.id;
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
      const logEntry = { 
          docket_id: id, 
          client_name: docketToDelete.client.name, 
          deleted_by: currentUser.email || 'Unknown User', 
          deleted_at: new Date().toISOString(), 
          reason 
      };
      const { error: logError } = await supabase.from('deletion_log').insert([logEntry]);
      if (logError) { setLoading(false); throw logError; }
      
      const { error: deleteError } = await supabase.from('dockets').delete().eq('id', id);
      if (deleteError) { setLoading(false); throw deleteError; }

      setDockets(prev => prev.filter(d => d.id !== id));
      const newLogEntry = await supabase.from('deletion_log').select('*').eq('docket_id', id).single();
      if(newLogEntry.data) {
         const mappedLog = {
            id: newLogEntry.data.id,
            docketId: newLogEntry.data.docket_id,
            clientName: newLogEntry.data.client_name,
            deletedBy: newLogEntry.data.deleted_by,
            deletedAt: newLogEntry.data.deleted_at,
            reason: newLogEntry.data.reason
          };
          setDeletionLog(prev => [mappedLog, ...prev]);
      }
    }
    setLoading(false);
  }, [dockets, currentUser]);

  const saveSupplier = useCallback(async (supplier: Omit<Supplier, 'id'>) => {
    const newSupplier = { ...supplier, id: `SUP-${Date.now()}` };
    const dbSupplier = {
        id: newSupplier.id,
        name: newSupplier.name,
        contact_person: newSupplier.contactPerson,
        contact_number: newSupplier.contactNumber,
    };
    const { data, error } = await supabase.from('suppliers').insert([dbSupplier]).select().single();
    if (error) throw error;
    if(data) setSuppliers(prev => [...prev, mapDbSupplierToAppSupplier(data)]);
  }, []);

  const saveAgent = useCallback(async (agent: Omit<Agent, 'id'>) => {
    const newAgent = { ...agent, id: `AGENT-${Date.now()}` };
    const dbAgent = {
        id: newAgent.id,
        name: newAgent.name,
        contact_info: newAgent.contactInfo,
    };
    const { data, error } = await supabase.from('agents').insert([dbAgent]).select().single();
    if (error) throw error;
    if(data) setAgents(prev => [...prev, mapDbAgentToAppAgent(data)]);
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
                setSettings(data.settings as unknown as CompanySettings);
            } else if (error && error.code === 'PGRST116') { // 'PGRST116' means no rows returned
                const { error: insertError } = await supabase
                    .from('company_settings')
                    .insert([{ id: 1, settings: DEFAULT_COMPANY_SETTINGS }]);
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
            .upsert([{ id: 1, settings: updatedSettings }]);
        
        if (error) {
            console.error("Error saving company settings:", error);
            alert("Failed to save settings.");
        } else {
            setSettings(updatedSettings);
        }
    };

    const getNextInvoiceNumber = async () => {
        const nextNum = settings.lastInvoiceNumber + 1;
        await updateSettings({ lastInvoiceNumber: nextNum });
        return nextNum;
    };
    
    return { settings, updateSettings, getNextInvoiceNumber };
};