/**
 * Exercises every read path the Netlify function uses, against the live Books org, using
 * the same credentials Netlify now holds. Writes nothing.
 *
 *   npx esbuild zoho-verify.mjs --bundle --format=esm --platform=node --outfile=zoho-verify.build.mjs
 *   node zoho-verify.build.mjs
 */
import fs from 'node:fs';
import { buildZohoInvoice, gstModeWarning } from './services/zohoInvoice';

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

let failures = 0;
const step = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
};

// 1. Token refresh - the same call the function makes on a cold start.
const tokenRes = await fetch(`${env.ZOHO_ACCOUNTS_HOST}/oauth/v2/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    refresh_token: env.ZOHO_REFRESH_TOKEN,
  }),
});
const token = await tokenRes.json();
step('refresh token exchanges for an access token', Boolean(token.access_token), token.error || `expires in ${token.expires_in}s`);
if (!token.access_token) process.exit(1);

const get = async (path) => {
  const sep = path.includes('?') ? '&' : '?';
  const r = await fetch(`${env.ZOHO_API_HOST}/books/v3/${path}${sep}organization_id=${env.ZOHO_ORG_ID}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token.access_token}` },
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok && (typeof body.code !== 'number' || body.code === 0), body };
};

// 2. search-contacts
const search = await get('contacts?contact_name_contains=a&per_page=5');
step('search-contacts returns contacts', search.ok && Array.isArray(search.body.contacts), `${search.body.contacts?.length ?? 0} matched`);

const withTreatment = (search.body.contacts || []).find((c) => c.gst_treatment);
step('contacts carry gst_treatment for the GST warning', Boolean(withTreatment),
  withTreatment ? `${withTreatment.contact_name} = ${withTreatment.gst_treatment}` : 'none in this sample');

// 3. sync-status against a real invoice
const list = await get('invoices?per_page=1');
const sample = list.body.invoices?.[0];
step('invoice list readable', Boolean(sample), sample?.invoice_number);
if (sample) {
  const one = await get(`invoices/${sample.invoice_id}`);
  const inv = one.body.invoice || {};
  step('sync-status can read a single invoice', one.ok && Boolean(inv.invoice_id),
    `${inv.invoice_number} status=${inv.status} balance=${inv.balance}`);
  step('status and balance present for the dashboard', inv.status !== undefined && inv.balance !== undefined);
}

// 4. Tax ids referenced by the mapper still exist in the org
const taxes = await get('settings/taxes');
const ids = new Set([
  ...(taxes.body.taxes || []).map((t) => t.tax_id),
  ...(taxes.body.tax_groups || []).map((g) => g.tax_group_id),
]);
for (const [label, id] of [
  ['intra 18% group', '5749603000000143193'],
  ['intra 5% group', '5749603000000143181'],
  ['inter 18% (IGST18)', '5749603000000143091'],
  ['inter 5% (IGST5)', '5749603000000143087'],
]) {
  step(`mapper tax id resolves: ${label}`, ids.has(id), id);
}

// 5. The mapper produces a payload shaped like a real invoice (built, not sent).
const payload = buildZohoInvoice({
  customerId: sample?.customer_id || 'UNKNOWN',
  date: new Date().toISOString().slice(0, 10),
  placeOfSupply: 'Telangana',
  lineItems: [{ id: '1', description: 'Flights: IndiGo (HYD-GOI) x5', quantity: 1, rate: 269420, isGstApplicable: false, gstRate: 0 }],
  serviceCharge: 1000,
  gstMode: 'service_charge_18',
  gstTreatment: 'business_gst',
  reference: '00204',
});
step('mapper builds a payload', payload.line_items.length === 2, `place_of_supply=${payload.place_of_supply}`);
step('service fee taxed, travel untaxed',
  !payload.line_items[0].tax_id && payload.line_items[1].tax_id === '5749603000000143091');
step('GST warning fires for 5% on a consumer', Boolean(gstModeWarning('package_5', 'consumer')));

console.log(`\n${failures ? `${failures} FAILING check(s)` : 'All checks passed — nothing was written to Zoho.'}`);
process.exit(failures ? 1 : 0);
