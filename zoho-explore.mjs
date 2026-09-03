/**
 * Reads the Zoho Books organisation so the docket -> invoice mapping can be written against
 * real ids. Prints names and ids only; never tokens.
 *
 *   node zoho-explore.mjs
 */
import fs from 'node:fs';

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }),
);

const { ZOHO_ORG_ID, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ACCOUNTS_HOST, ZOHO_API_HOST } = env;

const tokenResponse = await fetch(`${ZOHO_ACCOUNTS_HOST}/oauth/v2/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    refresh_token: ZOHO_REFRESH_TOKEN,
  }),
});
const token = await tokenResponse.json();
if (!token.access_token) {
  console.error('Could not refresh access token:', JSON.stringify(token));
  process.exit(1);
}
console.log('Access token obtained OK.\n');

const get = async (path) => {
  const url = `${ZOHO_API_HOST}/books/v3/${path}${path.includes('?') ? '&' : '?'}organization_id=${ZOHO_ORG_ID}`;
  const response = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token.access_token}` },
  });
  const body = await response.json().catch(() => ({}));
  if (body.code && body.code !== 0) console.log(`  (${path} -> ${body.code}: ${body.message})`);
  return body;
};

const orgs = await get('organizations');
console.log('=== ORGANISATIONS ===');
for (const o of orgs.organizations || []) {
  console.log(`  ${o.organization_id}  ${o.name}  | country=${o.country} currency=${o.currency_code} gst=${o.is_gst_registered ?? 'n/a'} fy=${o.fiscal_year_start_month ?? ''}`);
}

const taxes = await get('settings/taxes');
console.log('\n=== TAXES ===');
for (const t of taxes.taxes || []) {
  console.log(`  ${t.tax_id}  ${String(t.tax_percentage).padStart(5)}%  ${t.tax_name}  [${t.tax_type}]`);
}
const groups = taxes.tax_groups || [];
if (groups.length) {
  console.log('  -- tax groups --');
  for (const g of groups) console.log(`  ${g.tax_group_id}  ${g.tax_group_name} (${g.tax_group_percentage}%)`);
}

const items = await get('items');
console.log(`\n=== ITEMS (${(items.items || []).length}) ===`);
for (const i of (items.items || []).slice(0, 25)) {
  console.log(`  ${i.item_id}  ${i.name}  rate=${i.rate} tax=${i.tax_name || '-'} hsn=${i.hsn_or_sac || '-'}`);
}

const contacts = await get('contacts');
console.log(`\n=== CONTACTS (${(contacts.contacts || []).length} shown) ===`);
for (const c of (contacts.contacts || []).slice(0, 10)) {
  console.log(`  ${c.contact_id}  ${c.contact_name}  ${c.email || ''} gst=${c.gst_treatment || '-'}`);
}

const invoices = await get('invoices');
console.log(`\n=== RECENT INVOICES (${(invoices.invoices || []).length} shown) ===`);
for (const inv of (invoices.invoices || []).slice(0, 8)) {
  console.log(`  ${inv.invoice_number}  ${inv.date}  ${inv.customer_name}  total=${inv.total} balance=${inv.balance} status=${inv.status}`);
}
