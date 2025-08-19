// Customer and Invoice TypeScript Types

export interface Customer {
  id: string;
  customer_code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  billing_address?: string;
  amount: number;
  created_at: string;
  customer?: Customer; // For joined queries
}

export interface CustomerFormData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
}

export interface InvoiceFormData {
  customer_id: string;
  billing_address?: string;
  amount: number;
}

export interface CustomerSearchResult {
  id: string;
  customer_code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  gstin?: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface CustomerListResponse extends ApiResponse<Customer[]> {}
export interface CustomerResponse extends ApiResponse<Customer> {}
export interface InvoiceListResponse extends ApiResponse<Invoice[]> {}
export interface InvoiceResponse extends ApiResponse<Invoice> {}
