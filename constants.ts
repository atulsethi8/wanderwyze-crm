
import { BookingStatus, CompanySettings, Supplier, Client, Itinerary, Tag, Docket, LeadSource, Agent, AuthUser } from './types';

export const STATUS_COLORS: Record<BookingStatus, { bg: string; text: string; border: string }> = {
  [BookingStatus.InProgress]: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-500' },
  [BookingStatus.Confirmed]: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-500' },
  [BookingStatus.Cancelled]: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500' },
};

export const LEAD_SOURCES: LeadSource[] = Object.values(LeadSource);

export const INITIAL_CLIENT: Client = { name: '', contactInfo: '', leadSource: LeadSource.WalkIn };
export const INITIAL_ITINERARY: Itinerary = { flights: [], hotels: [], excursions: [], transfers: [] };
export const INITIAL_DOCKET_FORM_STATE: Omit<Docket, 'id' | 'searchTags' | 'createdAt' | 'updatedAt'> = {
    client: INITIAL_CLIENT,
    status: BookingStatus.InProgress,
    tag: Tag.Individual,
    agentId: null,
    passengers: [],
    itinerary: INITIAL_ITINERARY,
    files: [],
    comments: [],
    payments: [],
    invoices: [],
    createdBy: '',
};

export const DEFAULT_SUPPLIERS: Supplier[] = [
    { id: 'SUP-1', name: 'Indigo', contactPerson: 'Sales Team', contactNumber: '0124-1111111' },
    { id: 'SUP-2', name: 'Vistara', contactPerson: 'Bookings', contactNumber: '0124-2222222' },
    { id: 'SUP-3', name: 'MakeMyTrip B2B', contactPerson: 'Support', contactNumber: '0124-3333333' },
];

export const DEFAULT_AGENTS: Agent[] = [
    { id: 'AGENT-1', name: 'Ramesh Kumar', contactInfo: 'ramesh@example.com' },
    { id: 'AGENT-2', name: 'Sunita Sharma', contactInfo: 'sunita@example.com' },
];

export const DEFAULT_USERS: AuthUser[] = [
  { id: 'user-1', name: 'Admin User', email: 'admin@wanderwyze.com', role: 'admin' },
  { id: 'user-2', name: 'Standard User', email: 'user@wanderwyze.com', role: 'user' },
];

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
    companyName: 'WanderWyze Travel Co.',
    companyAddress: '123 Travel Lane, New Delhi, India',
    companyContact: '+91 98765 43210 | contact@wanderwyze.com',
    bankName: 'Global Bank',
    accountNumber: '1234567890',
    ifscCode: 'GBL0000123',
    gstNumber: '',
    companyState: 'Delhi',
    lastInvoiceNumber: 1000
};