
export enum BookingStatus {
  InProgress = 'In Progress',
  Confirmed = 'Confirmed',
  Cancelled = 'Cancelled',
}

export enum Tag {
  Individual = 'Individual',
  Group = 'Group',
}

export enum PaymentType {
  Cash = 'Cash',
  BankTransfer = 'Bank Transfer',
  CreditCard = 'Credit Card',
  Other = 'Other',
}

export enum PassengerType {
    Adult = 'Adult',
    Child = 'Child',
    Infant = 'Infant',
}

export enum Gender {
    Male = 'Male',
    Female = 'Female',
    Other = 'Other',
}

export enum LeadSource {
    WalkIn = "Walk-in",
    Referral = "Referral",
    SocialMedia = "Social Media",
    Website = "Website",
    ColdCall = "Cold Call",
    Other = "Other",
}

export enum LeadStatus {
    Cold = 'cold',
    Warm = 'warm',
    Final = 'final'
}

export interface Client {
  name: string;
  contactInfo: string;
  leadSource: LeadSource;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  source: string;
  status: LeadStatus;
  description: string;
  assignedTo: string;
  expectedValue: number;
  createdDate: string;
  lastContactDate?: string;
  nextFollowUpDate?: string;
  notes: string;
  // Travel details
  travelDates: {
    departureDate: string;
    returnDate: string;
  };
  numberOfPax: number;
  // Day-wise itinerary tracking
  itinerary: {
    day1?: string;
    day2?: string;
    day3?: string;
    day4?: string;
    day5?: string;
    day6?: string;
    day7?: string;
    day8?: string;
    day9?: string;
    day10?: string;
  };
  // Quotation details with separate fields
  quotation: {
    flights: number;
    hotels: number;
    excursions: number;
    transfers: number;
    total: number;
  };
}

export interface Passenger {
  id: string;
  fullName: string;
  type: PassengerType;
  gender: Gender;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  contactNumber: string;
}

export interface Agent {
  id: string;
  name: string;
  contactInfo: string;
}

export interface FlightPassengerDetail {
    passengerId: string;
    passengerType: PassengerType;
    netCost: number;
    grossBilled: number;
}

export interface Flight {
  id: string;
  airline: string;
  pnr: string;
  bookingId?: string;
  flightNumber?: string;
  departureDate: string;
  departureTime?: string;
  returnDate?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  departureAirport: string;
  arrivalAirport: string;
  supplier: Supplier | null;
  isNetGrossSameForAll: boolean;
  commonNetCost: number;
  commonGrossBilled: number;
  passengerDetails: FlightPassengerDetail[];
}

export interface Hotel {
  id: string;
  name: string;
  checkIn: string;
  checkOut: string;
  numberOfRooms: number;
  netCost: number;
  grossBilled: number;
  supplier: Supplier | null;
  paxRefs: string[];
}

export interface Excursion {
  id:string;
  name: string;
  date: string;
  netCost: number;
  grossBilled: number;
  supplier: Supplier | null;
}

export interface Transfer {
  id: string;
  provider: string;
  date: string;
  netCost: number;
  grossBilled: number;
  supplier: Supplier | null;
}

export interface Itinerary {
  flights: Flight[];
  hotels: Hotel[];
  excursions: Excursion[];
  transfers: Transfer[];
  // New: optional single service charge totals for the itinerary
  serviceCharge?: {
    netCost: number;
    grossBilled: number;
  };
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  type: PaymentType;
  notes?: string;
}

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string; // Base64 encoded content
  linkedItemId?: string;
  linkedItemType?: 'flight' | 'hotel' | 'excursion' | 'transfer';
}

export interface Comment {
  id: string;
  text: string;
  timestamp: string;
  author?: string;
  isSystem?: boolean;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  isGstApplicable: boolean;
  gstRate: number; // as percentage
}

export interface BilledTo {
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  gstin?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  billedTo: BilledTo;
  lineItems: InvoiceLineItem[];
  notes: string;
  placeOfSupply: string;
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
  gstType: 'IGST' | 'CGST/SGST';
  companySettings: CompanySettings; // snapshot of settings at time of creation
  terms: string;
  dueDate: string;
}


export interface Docket {
  id: string;
  docketNo?: string; // optional 5-digit display number for new dockets
  client: Client;
  status: BookingStatus;
  tag: Tag;
  agentId: string | null;
  passengers: Passenger[];
  itinerary: Itinerary;
  files: UploadedFile[];
  comments: Comment[];
  payments: Payment[];
  invoices: Invoice[];
  searchTags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  role: 'admin' | 'user';
}

export interface DocketDeletionLog {
  id: number;
  docketId: string;
  clientName: string;
  deletedBy: string;
  deletedAt: string;
  reason: string;
}

export interface CompanySettings {
  companyName: string;
  companyAddress: string;
  companyContact: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  gstNumber?: string;
  companyState: string;
  lastInvoiceNumber: number;
}