import { supabase } from '../services';
import { ZohoInvoicePayload } from './zohoInvoice';

/**
 * Browser-side client for the Zoho Books proxy.
 *
 * Holds no credentials: every call carries the user's Supabase session, and the Netlify
 * function is what actually knows the Zoho refresh token.
 */

export interface ZohoContact {
  contactId: string;
  name: string;
  email?: string;
  /** business_gst / business_registered_composition / consumer / overseas. Drives which GST modes are legal. */
  gstTreatment?: string;
  gstNo?: string;
  placeOfSupply?: string;
}

export interface ZohoInvoiceSummary {
  invoiceId: string;
  invoiceNumber: string;
  /** draft | sent | overdue | paid | partially_paid | void */
  status: string;
  total: number;
  balance: number;
  date: string;
  dueDate?: string;
  customerName?: string;
  error?: string;
}

const call = async <T>(action: string, payload: unknown): Promise<T> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Your session has expired. Please sign in again.');

  const response = await fetch('/.netlify/functions/zoho', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, payload }),
  });

  // `vite dev` does not serve Netlify functions, so the SPA fallback returns index.html.
  // Name that explicitly rather than surfacing a confusing JSON parse failure.
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      'The Zoho connection is not running. Plain `npm run dev` does not serve Netlify functions - use `npx netlify dev` to test this locally.',
    );
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Zoho request failed (${response.status})`);
  return result as T;
};

export const zohoService = {
  searchContacts: (query: string) =>
    call<{ contacts: ZohoContact[] }>('search-contacts', { query }).then((r) => r.contacts),

  /** Creates the invoice as a draft. Marking it sent is a separate, deliberate step. */
  createDraftInvoice: (payload: ZohoInvoicePayload) =>
    call<{ invoice: ZohoInvoiceSummary }>('create-invoice', payload).then((r) => r.invoice),

  markSent: (invoiceId: string) =>
    call<{ invoice: ZohoInvoiceSummary }>('mark-sent', { invoiceId }).then((r) => r.invoice),

  syncStatus: (invoiceIds: string[]) =>
    call<{ invoices: ZohoInvoiceSummary[] }>('sync-status', { invoiceIds }).then((r) => r.invoices),
};
