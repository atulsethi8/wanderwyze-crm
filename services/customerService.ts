import { supabase } from '../services';
import { 
  Customer, 
  CustomerFormData, 
  Invoice, 
  InvoiceFormData, 
  CustomerSearchResult,
  CustomerListResponse,
  CustomerResponse,
  InvoiceListResponse,
  InvoiceResponse
} from '../types/customer';

// Customer Service Functions
export const customerService = {
  // Get all customers
  async getAllCustomers(): Promise<CustomerListResponse> {
    try {
      const { data, error } = await supabase
        .from('customer_master')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch customers' 
      };
    }
  },

  // Get customer by ID
  async getCustomerById(id: string): Promise<CustomerResponse> {
    try {
      const { data, error } = await supabase
        .from('customer_master')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch customer' 
      };
    }
  },

  // Search customers by name or customer code
  async searchCustomers(query: string): Promise<CustomerListResponse> {
    try {
      const { data, error } = await supabase
        .from('customer_master')
        .select('*')
        .or(`name.ilike.%${query}%,customer_code.ilike.%${query}%`)
        .order('name', { ascending: true })
        .limit(10);

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to search customers' 
      };
    }
  },

  // Create new customer
  async createCustomer(customerData: CustomerFormData): Promise<CustomerResponse> {
    try {
      // First, get the next customer code
      const { data: customerCode, error: codeError } = await supabase
        .rpc('generate_customer_code');

      if (codeError) throw codeError;

      // Create the customer with the generated code
      const { data, error } = await supabase
        .from('customer_master')
        .insert([{
          customer_code: customerCode,
          ...customerData
        }])
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to create customer' 
      };
    }
  },

  // Update customer
  async updateCustomer(id: string, customerData: Partial<CustomerFormData>): Promise<CustomerResponse> {
    try {
      const { data, error } = await supabase
        .from('customer_master')
        .update(customerData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to update customer' 
      };
    }
  },

  // Delete customer
  async deleteCustomer(id: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('customer_master')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Failed to delete customer' 
      };
    }
  }
};

// Invoice Service Functions
export const invoiceService = {
  // Get all invoices with customer details
  async getAllInvoices(): Promise<InvoiceListResponse> {
    try {
      const { data, error } = await supabase
        .from('invoice')
        .select(`
          *,
          customer:customer_master(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch invoices' 
      };
    }
  },

  // Get invoice by ID with customer details
  async getInvoiceById(id: string): Promise<InvoiceResponse> {
    try {
      const { data, error } = await supabase
        .from('invoice')
        .select(`
          *,
          customer:customer_master(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch invoice' 
      };
    }
  },

  // Get invoices by customer ID
  async getInvoicesByCustomerId(customerId: string): Promise<InvoiceListResponse> {
    try {
      const { data, error } = await supabase
        .from('invoice')
        .select(`
          *,
          customer:customer_master(*)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch customer invoices' 
      };
    }
  },

  // Create new invoice
  async createInvoice(invoiceData: InvoiceFormData): Promise<InvoiceResponse> {
    try {
      // First, get the next invoice number
      const { data: invoiceNumber, error: numberError } = await supabase
        .rpc('generate_invoice_number');

      if (numberError) throw numberError;

      // Create the invoice with the generated number
      const { data, error } = await supabase
        .from('invoice')
        .insert([{
          invoice_number: invoiceNumber,
          ...invoiceData
        }])
        .select(`
          *,
          customer:customer_master(*)
        `)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to create invoice' 
      };
    }
  },

  // Update invoice
  async updateInvoice(id: string, invoiceData: Partial<InvoiceFormData>): Promise<InvoiceResponse> {
    try {
      const { data, error } = await supabase
        .from('invoice')
        .update(invoiceData)
        .eq('id', id)
        .select(`
          *,
          customer:customer_master(*)
        `)
        .single();

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to update invoice' 
      };
    }
  },

  // Delete invoice
  async deleteInvoice(id: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('invoice')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Failed to delete invoice' 
      };
    }
  }
};

