import { createClient } from '@supabase/supabase-js';

/**
 * Zoho Books proxy.
 *
 * The Zoho refresh token and client secret grant full access to the accounting books, so
 * they must never reach the browser. This function is the only thing that holds them: the
 * client sends an action plus a payload, authenticated with its Supabase session, and gets
 * back only the fields it needs.
 *
 * Required Netlify environment variables:
 *   ZOHO_ORG_ID, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN,
 *   ZOHO_ACCOUNTS_HOST, ZOHO_API_HOST
 *
 * The hosts are configurable because the data centre is per-organisation (this org is on
 * the US centre, not .in, despite being an Indian business - check ZOHO_ACCOUNTS_HOST in
 * .env.local or the Netlify UI if unsure). A data-centre mismatch fails with INVALID_TOKEN,
 * which reads like a credentials problem but is actually routing.
 */

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Access tokens last an hour. Cached across warm invocations to avoid a refresh per call. */
let cachedToken: { value: string; expiresAt: number } | null = null;

const getAccessToken = async (): Promise<string> => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const response = await fetch(`${process.env.ZOHO_ACCOUNTS_HOST}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ZOHO_CLIENT_ID || '',
      client_secret: process.env.ZOHO_CLIENT_SECRET || '',
      refresh_token: process.env.ZOHO_REFRESH_TOKEN || '',
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!body.access_token) {
    throw new Error(`Zoho refused the refresh token: ${body.error || 'unknown error'}`);
  }
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + (Number(body.expires_in) || 3600) * 1000,
  };
  return cachedToken.value;
};

const zoho = async (path: string, init: RequestInit = {}) => {
  const token = await getAccessToken();
  const separator = path.includes('?') ? '&' : '?';
  const url = `${process.env.ZOHO_API_HOST}/books/v3/${path}${separator}organization_id=${process.env.ZOHO_ORG_ID}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));

  // Zoho signals failure through its own code field, not only the HTTP status.
  if (!response.ok || (typeof body.code === 'number' && body.code !== 0)) {
    throw new Error(body.message || `Zoho request failed (${response.status})`);
  }
  return body;
};

/** Only the fields the CRM stores, so an invoice response is not echoed wholesale. */
const summarise = (invoice: any) => ({
  invoiceId: invoice.invoice_id,
  invoiceNumber: invoice.invoice_number,
  status: invoice.status,
  subTotal: invoice.sub_total,
  taxTotal: invoice.tax_total,
  total: invoice.total,
  balance: invoice.balance,
  date: invoice.date,
  dueDate: invoice.due_date,
  customerName: invoice.customer_name,
  // Matches the URL pattern Books itself uses (books.zoho.com/app/{org}#/invoices/{id}),
  // built server-side since the org id is not otherwise exposed to the browser.
  invoiceUrl: `${(process.env.ZOHO_ACCOUNTS_HOST || '').includes('.in') ? 'https://books.zoho.in' : 'https://books.zoho.com'}/app/${process.env.ZOHO_ORG_ID}#/invoices/${invoice.invoice_id}`,
});

export const handler = async (event: any) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const token = event.headers.authorization?.replace(/^Bearer\s+/i, '');
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!token || !supabaseUrl || !supabaseAnonKey) return json(401, { error: 'Authentication required' });

    if (!process.env.ZOHO_REFRESH_TOKEN || !process.env.ZOHO_ORG_ID) {
      return json(500, { error: 'Zoho is not configured on this deployment.' });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return json(401, { error: 'Invalid or expired session' });

    const { action, payload } = JSON.parse(event.body || '{}');

    switch (action) {
      // Match a docket's client against existing Books contacts. Deliberately read-only:
      // the contact list is already inconsistent, and blind creation would worsen it.
      case 'search-contacts': {
        const query = encodeURIComponent(String(payload?.query || '').trim());
        if (!query) return json(400, { error: 'A search term is required' });
        const result = await zoho(`contacts?contact_name_contains=${query}&per_page=20`);
        return json(200, {
          contacts: (result.contacts || []).map((c: any) => ({
            contactId: c.contact_id,
            name: c.contact_name,
            email: c.email,
            gstTreatment: c.gst_treatment,
            gstNo: c.gst_no,
            placeOfSupply: c.place_of_contact,
          })),
        });
      }

      // Always created as a draft. Marking sent is a separate, deliberate step so a bad
      // mapping is something to delete rather than a document already with a client.
      case 'create-invoice': {
        if (!payload?.customer_id || !payload?.line_items?.length) {
          return json(400, { error: 'The invoice payload is incomplete' });
        }
        const result = await zoho('invoices', { method: 'POST', body: JSON.stringify(payload) });
        return json(200, { invoice: summarise(result.invoice) });
      }

      case 'mark-sent': {
        const id = payload?.invoiceId;
        if (!id) return json(400, { error: 'An invoice id is required' });
        await zoho(`invoices/${id}/status/sent`, { method: 'POST' });
        const result = await zoho(`invoices/${id}`);
        return json(200, { invoice: summarise(result.invoice) });
      }

      // Pulls current status and balance so the dashboard reflects real payments.
      case 'sync-status': {
        const ids: string[] = payload?.invoiceIds || [];
        if (!ids.length) return json(400, { error: 'At least one invoice id is required' });
        const invoices = [];
        for (const id of ids.slice(0, 50)) {
          try {
            const result = await zoho(`invoices/${id}`);
            invoices.push(summarise(result.invoice));
          } catch (e: any) {
            invoices.push({ invoiceId: id, error: e?.message || 'Not found' });
          }
        }
        return json(200, { invoices });
      }

      default:
        return json(400, { error: `Unknown action: ${action}` });
    }
  } catch (error: any) {
    console.error('Zoho request failed', error);
    return json(500, { error: error?.message || 'Zoho request failed' });
  }
};
