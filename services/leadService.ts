import { createClient } from '@supabase/supabase-js';
import { Lead, LeadStatus } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export interface DatabaseLead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  source: string;
  status: string;
  description: string;
  assigned_to: string;
  expected_value: number;
  created_date: string;
  last_contact_date?: string;
  next_follow_up_date?: string;
  notes: string;
  travel_dates: {
    departureDate: string;
    returnDate: string;
  };
  number_of_pax: number;
  number_of_nights: number; // Added
  created_at: string;
  updated_at: string;
}

export interface DatabaseItinerary {
  id: string;
  lead_id: string;
  day_number: number;
  itinerary_text: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseQuotation {
  id: string;
  lead_id: string;
  flights: number;
  hotels: number;
  excursions: number;
  transfers: number;
  total: number;
  created_at: string;
  updated_at: string;
}

// Transform database lead to frontend lead format
const transformDatabaseLeadToLead = (dbLead: DatabaseLead, itinerary: DatabaseItinerary[], quotation: DatabaseQuotation | null): Lead => {
  const itineraryMap: { [key: string]: string } = {};
  itinerary.forEach(item => {
    itineraryMap[`day${item.day_number}`] = item.itinerary_text;
  });

  return {
    id: dbLead.id,
    name: dbLead.name,
    email: dbLead.email,
    phone: dbLead.phone,
    company: dbLead.company,
    source: dbLead.source,
    status: dbLead.status as LeadStatus,
    description: dbLead.description,
    assignedTo: dbLead.assigned_to,
    expectedValue: dbLead.expected_value,
    createdDate: dbLead.created_date,
    lastContactDate: dbLead.last_contact_date,
    nextFollowUpDate: dbLead.next_follow_up_date,
    notes: dbLead.notes,
    travelDates: dbLead.travel_dates,
    numberOfPax: dbLead.number_of_pax,
    numberOfNights: dbLead.number_of_nights, // Added
    itinerary: itineraryMap,
    quotation: {
      flights: quotation?.flights || 0,
      hotels: quotation?.hotels || 0,
      excursions: quotation?.excursions || 0,
      transfers: quotation?.transfers || 0,
      total: quotation?.total || 0
    }
  };
};

// Transform frontend lead to database format
const transformLeadToDatabaseFormat = (lead: Omit<Lead, 'id'>) => {
  const { itinerary, quotation, ...leadData } = lead;

  const normalizeDate = (value?: string) => {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  };

  return {
    name: leadData.name,
    email: leadData.email,
    phone: leadData.phone,
    company: leadData.company,
    source: leadData.source,
    status: leadData.status,
    description: leadData.description,
    assigned_to: leadData.assignedTo,
    expected_value: leadData.expectedValue,
    created_date: normalizeDate(leadData.createdDate) || new Date().toISOString().split('T')[0],
    last_contact_date: normalizeDate(leadData.lastContactDate),
    next_follow_up_date: normalizeDate(leadData.nextFollowUpDate),
    notes: leadData.notes,
    travel_dates: leadData.travelDates,
    number_of_pax: leadData.numberOfPax,
    number_of_nights: leadData.numberOfNights // Added
  };
};

export const leadService = {
  // Get all leads
  async getAllLeads(): Promise<Lead[]> {
    try {
      // Get leads
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      if (!leads || leads.length === 0) return [];

      const leadIds = leads.map(lead => lead.id);

      // Get itinerary for all leads
      const { data: itinerary, error: itineraryError } = await supabase
        .from('lead_itinerary')
        .select('*')
        .in('lead_id', leadIds);

      if (itineraryError) throw itineraryError;

      // Get quotation for all leads
      const { data: quotations, error: quotationError } = await supabase
        .from('lead_quotation')
        .select('*')
        .in('lead_id', leadIds);

      if (quotationError) throw quotationError;

      // Transform and combine data
      return leads.map(lead => {
        const leadItinerary = itinerary?.filter(item => item.lead_id === lead.id) || [];
        const leadQuotation = quotations?.find(item => item.lead_id === lead.id) || null;
        return transformDatabaseLeadToLead(lead, leadItinerary, leadQuotation);
      });
    } catch (error) {
      console.error('Error fetching leads:', error);
      throw error;
    }
  },

  // Get lead by ID
  async getLeadById(id: string): Promise<Lead | null> {
    try {
      // Get lead
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();

      if (leadError) throw leadError;
      if (!lead) return null;

      // Get itinerary
      const { data: itinerary, error: itineraryError } = await supabase
        .from('lead_itinerary')
        .select('*')
        .eq('lead_id', id);

      if (itineraryError) throw itineraryError;

      // Get quotation
      const { data: quotation, error: quotationError } = await supabase
        .from('lead_quotation')
        .select('*')
        .eq('lead_id', id)
        .single();

      if (quotationError && quotationError.code !== 'PGRST116') throw quotationError;

      return transformDatabaseLeadToLead(lead, itinerary || [], quotation);
    } catch (error) {
      console.error('Error fetching lead:', error);
      throw error;
    }
  },

  // Create new lead
  async createLead(lead: Omit<Lead, 'id'>): Promise<Lead> {
    try {
      const leadData = transformLeadToDatabaseFormat(lead);

      // Insert lead
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert(leadData)
        .select()
        .single();

      if (leadError) throw leadError;

      // Insert itinerary
      if (lead.itinerary && Object.keys(lead.itinerary).length > 0) {
        const itineraryData = Object.entries(lead.itinerary)
          .filter(([_, text]) => text && text.trim() !== '')
          .map(([day, text]) => ({
            lead_id: newLead.id,
            day_number: parseInt(day.replace('day', '')),
            itinerary_text: text
          }));

        if (itineraryData.length > 0) {
          const { error: itineraryError } = await supabase
            .from('lead_itinerary')
            .insert(itineraryData);

          if (itineraryError) throw itineraryError;
        }
      }

      // Insert quotation
      if (lead.quotation && (lead.quotation.flights > 0 || lead.quotation.hotels > 0 || lead.quotation.excursions > 0 || lead.quotation.transfers > 0)) {
        const { error: quotationError } = await supabase
          .from('lead_quotation')
          .insert({
            lead_id: newLead.id,
            flights: lead.quotation.flights,
            hotels: lead.quotation.hotels,
            excursions: lead.quotation.excursions,
            transfers: lead.quotation.transfers
          });

        if (quotationError) throw quotationError;
      }

      // Return the complete lead
      return await this.getLeadById(newLead.id) as Lead;
    } catch (error) {
      console.error('Error creating lead:', error);
      throw error;
    }
  },

  // Update lead
  async updateLead(lead: Lead): Promise<Lead> {
    try {
      const leadData = transformLeadToDatabaseFormat(lead);

      // Update lead
      const { error: leadError } = await supabase
        .from('leads')
        .update(leadData)
        .eq('id', lead.id);

      if (leadError) throw leadError;

      // Delete existing itinerary and quotation
      await supabase.from('lead_itinerary').delete().eq('lead_id', lead.id);
      await supabase.from('lead_quotation').delete().eq('lead_id', lead.id);

      // Insert updated itinerary
      if (lead.itinerary && Object.keys(lead.itinerary).length > 0) {
        const itineraryData = Object.entries(lead.itinerary)
          .filter(([_, text]) => text && text.trim() !== '')
          .map(([day, text]) => ({
            lead_id: lead.id,
            day_number: parseInt(day.replace('day', '')),
            itinerary_text: text
          }));

        if (itineraryData.length > 0) {
          const { error: itineraryError } = await supabase
            .from('lead_itinerary')
            .insert(itineraryData);

          if (itineraryError) throw itineraryError;
        }
      }

      // Insert updated quotation
      if (lead.quotation && (lead.quotation.flights > 0 || lead.quotation.hotels > 0 || lead.quotation.excursions > 0 || lead.quotation.transfers > 0)) {
        const { error: quotationError } = await supabase
          .from('lead_quotation')
          .insert({
            lead_id: lead.id,
            flights: lead.quotation.flights,
            hotels: lead.quotation.hotels,
            excursions: lead.quotation.excursions,
            transfers: lead.quotation.transfers
          });

        if (quotationError) throw quotationError;
      }

      // Return the updated lead
      return await this.getLeadById(lead.id) as Lead;
    } catch (error) {
      console.error('Error updating lead:', error);
      throw error;
    }
  },

  // Delete lead
  async deleteLead(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting lead:', error);
      throw error;
    }
  },

  // Get leads by status
  async getLeadsByStatus(status: LeadStatus): Promise<Lead[]> {
    try {
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      if (!leads || leads.length === 0) return [];

      const leadIds = leads.map(lead => lead.id);

      // Get itinerary and quotation for these leads
      const [itineraryResult, quotationResult] = await Promise.all([
        supabase.from('lead_itinerary').select('*').in('lead_id', leadIds),
        supabase.from('lead_quotation').select('*').in('lead_id', leadIds)
      ]);

      if (itineraryResult.error) throw itineraryResult.error;
      if (quotationResult.error) throw quotationResult.error;

      return leads.map(lead => {
        const leadItinerary = itineraryResult.data?.filter(item => item.lead_id === lead.id) || [];
        const leadQuotation = quotationResult.data?.find(item => item.lead_id === lead.id) || null;
        return transformDatabaseLeadToLead(lead, leadItinerary, leadQuotation);
      });
    } catch (error) {
      console.error('Error fetching leads by status:', error);
      throw error;
    }
  }
};
