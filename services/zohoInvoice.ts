import { InvoiceLineItem } from '../types';

/**
 * Builds a Zoho Books invoice payload from a docket.
 *
 * Written against the shape of Wander Wyze's own recent invoices rather than the generic API
 * docs, because the GST treatment is a business decision the docs cannot express:
 *
 *   - a service fee with 18% GST on the fee alone, the travel itself out of scope (most
 *     common: the agency acts as a pure agent)
 *   - 5% on the whole package value, which applies to a registered business
 *   - no GST at all
 *
 * The agent chooses per invoice; nothing is inferred from the customer record. gstModeWarning
 * flags the B2B caveat on the 5% rate without blocking it.
 *
 * Line items are deliberately ad-hoc (name + rate, no item_id). The Books item catalogue is
 * already polluted with per-booking entries like "FLIGHT BOM-HYD-BOM" and "MR NEERAJ JHA";
 * creating an item per docket would make that materially worse for no benefit.
 */

export type GstMode = 'package_5' | 'service_charge_18' | 'none';

/** SAC code for tour-operator / travel-agency services. */
export const TRAVEL_SAC = '998555';

/**
 * Tax identifiers from the Wander Wyze Books organisation.
 *
 * Intra-state supply uses a tax *group* (CGST + SGST components); inter-state uses a single
 * IGST tax. Zoho rejects the wrong kind for the supply, so the choice is not cosmetic.
 */
export interface ZohoTaxConfig {
  /** The agency's own state code. Supply within it is intra-state. */
  homeStateCode: string;
  /** tax_group ids - CGST + SGST split. */
  intra: { zero: string; five: string; eighteen: string };
  /** tax ids - single IGST line. */
  inter: { zero: string; five: string; eighteen: string };
}

export const WANDERWYZE_TAXES: ZohoTaxConfig = {
  homeStateCode: 'DL',
  intra: {
    zero: '5749603000000143175', // GST0
    five: '5749603000000143181', // GST5  = CGST2.5 + SGST2.5
    eighteen: '5749603000000143193', // GST18 = CGST9 + SGST9
  },
  inter: {
    zero: '5749603000000143085', // IGST0
    five: '5749603000000143087', // IGST5
    eighteen: '5749603000000143091', // IGST18
  },
};

/**
 * GST state codes. Zoho expects the two-letter form ("TS"), not the full name the CRM
 * stores, and rejects the invoice outright if it does not recognise the value.
 */
export const STATE_CODES: Record<string, string> = {
  'Andaman and Nicobar Islands': 'AN',
  'Andhra Pradesh': 'AP',
  'Arunachal Pradesh': 'AR',
  Assam: 'AS',
  Bihar: 'BR',
  Chandigarh: 'CH',
  Chhattisgarh: 'CG',
  'Dadra and Nagar Haveli and Daman and Diu': 'DN',
  Delhi: 'DL',
  Goa: 'GA',
  Gujarat: 'GJ',
  Haryana: 'HR',
  'Himachal Pradesh': 'HP',
  'Jammu and Kashmir': 'JK',
  Jharkhand: 'JH',
  Karnataka: 'KA',
  Kerala: 'KL',
  Ladakh: 'LA',
  Lakshadweep: 'LD',
  'Madhya Pradesh': 'MP',
  Maharashtra: 'MH',
  Manipur: 'MN',
  Meghalaya: 'ML',
  Mizoram: 'MZ',
  Nagaland: 'NL',
  Odisha: 'OD',
  Puducherry: 'PY',
  Punjab: 'PB',
  Rajasthan: 'RJ',
  Sikkim: 'SK',
  'Tamil Nadu': 'TN',
  Telangana: 'TS',
  Tripura: 'TR',
  'Uttar Pradesh': 'UP',
  Uttarakhand: 'UK',
  'West Bengal': 'WB',
};

/** Accepts either a full state name or an already-valid two-letter code. */
export const toStateCode = (value: string): string => {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  const exact = STATE_CODES[trimmed];
  if (exact) return exact;
  const match = Object.keys(STATE_CODES).find(
    (name) => name.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ? STATE_CODES[match] : '';
};

/** Zoho contact treatments that represent a registered business. */
const B2B_TREATMENTS = ['business_gst', 'business_registered_composition', 'business_sez'];

export const isB2B = (gstTreatment?: string) => B2B_TREATMENTS.includes(gstTreatment || '');

/**
 * Every mode is always offered: the GST treatment is the agent's decision at invoice time,
 * not something to be inferred from the record.
 */
export const GST_MODES: GstMode[] = ['service_charge_18', 'package_5', 'none'];

export const GST_MODE_LABELS: Record<GstMode, string> = {
  service_charge_18: 'Service charge — 18% GST on the fee only',
  package_5: 'Package — 5% GST on the total',
  none: 'No GST',
};

/**
 * A caution shown beside the choice, never a block.
 *
 * The 5% package rate applies to a registered business, but Zoho contacts frequently have
 * gst_treatment unset, so absence is not evidence of a consumer. Refusing the selection
 * outright would obstruct legitimate invoices; the agent is told and decides.
 */
export const gstModeWarning = (mode: GstMode, gstTreatment?: string): string | null => {
  if (mode !== 'package_5') return null;
  if (isB2B(gstTreatment)) return null;
  if (!gstTreatment) {
    return 'This customer has no GST treatment set in Zoho. The 5% package rate applies to registered businesses — check before sending.';
  }
  return `This customer is "${gstTreatment}" in Zoho, not a registered business. The 5% package rate normally applies only to B2B customers.`;
};

/**
 * How a line that bears no GST is classified. This is not the same as a 0% tax: a zero-rated
 * line still appears in the GST returns as a taxable supply, whereas out-of-scope does not
 * appear at all. Zoho describes it as "Supplies on which you don't charge any GST or include
 * them in the returns".
 */
export type UntaxedTreatment = 'out_of_scope' | 'non_gst_supply';

export interface ZohoLineItem {
  name: string;
  description?: string;
  rate: number;
  quantity: number;
  tax_id?: string;
  hsn_or_sac?: string;
  /** Set instead of tax_id on lines that bear no GST. */
  gst_treatment_code?: UntaxedTreatment;
  product_type?: 'goods' | 'service';
}

export interface ZohoInvoicePayload {
  customer_id: string;
  date: string;
  place_of_supply: string;
  line_items: ZohoLineItem[];
  reference_number?: string;
  notes?: string;
  terms?: string;
  due_date?: string;
}

export interface BuildInvoiceInput {
  customerId: string;
  /** Invoice date, yyyy-mm-dd. */
  date: string;
  dueDate?: string;
  /** Full state name or two-letter code. */
  placeOfSupply: string;
  /** Travel components. Rates are gross amounts already billed to the client. */
  lineItems: InvoiceLineItem[];
  /** The agency fee, taxed at 18% under service-charge mode. Ignored in other modes. */
  serviceCharge?: number;
  gstMode: GstMode;
  /** From the matched Zoho contact, used to reject an invalid mode. */
  gstTreatment?: string;
  /** Docket number, so the invoice can be traced back from Books. */
  reference?: string;
  /** Classification for lines bearing no GST. Defaults to out of scope. */
  untaxedTreatment?: UntaxedTreatment;
  notes?: string;
  terms?: string;
  taxes?: ZohoTaxConfig;
}

export class ZohoMappingError extends Error {}

export const buildZohoInvoice = (input: BuildInvoiceInput): ZohoInvoicePayload => {
  const taxes = input.taxes ?? WANDERWYZE_TAXES;

  const placeOfSupply = toStateCode(input.placeOfSupply);
  if (!placeOfSupply) {
    throw new ZohoMappingError(
      `Place of supply "${input.placeOfSupply}" is not a recognised Indian state. Zoho will reject the invoice without it.`,
    );
  }

  if (!input.customerId) {
    throw new ZohoMappingError('A Zoho customer must be matched before the invoice can be created.');
  }

  // No check on the GST mode against the customer type: the treatment is chosen per invoice
  // by the agent. gstModeWarning surfaces the B2B caveat in the UI without blocking.

  // Intra-state supply splits into CGST + SGST via a tax group; inter-state uses one IGST tax.
  const intraState = placeOfSupply === taxes.homeStateCode;
  const rates = intraState ? taxes.intra : taxes.inter;

  const billable = input.lineItems.filter((item) => (Number(item.rate) || 0) !== 0);
  if (!billable.length) {
    throw new ZohoMappingError('The invoice has no line items with a value.');
  }

  const travelTaxId = input.gstMode === 'package_5' ? rates.five : undefined;

  // A line must declare either a tax or a GST treatment; sending neither is rejected with
  // "Specify either a Tax or Tax Exemption". Untaxed travel is classified out of scope
  // rather than zero-rated, matching how these invoices are raised by hand - and the two
  // are not interchangeable, since a zero-rated line still enters the GST returns.
  //
  // A tax exemption would be the obvious alternative, but Zoho rejects an invoice that mixes
  // exempt and taxable lines under rule 46A. An out-of-scope line is not caught by that rule,
  // which is what allows the travel-plus-service-fee invoice to exist at all.
  const untaxed = input.untaxedTreatment ?? 'out_of_scope';

  const line_items: ZohoLineItem[] = billable.map((item) => ({
    name: (item.description || 'Travel services').slice(0, 100),
    description: item.description || '',
    rate: Number(item.rate) || 0,
    quantity: Number(item.quantity) || 1,
    product_type: 'service',
    // A SAC belongs only on lines that actually bear tax.
    ...(travelTaxId
      ? { tax_id: travelTaxId, hsn_or_sac: TRAVEL_SAC }
      : { gst_treatment_code: untaxed }),
  }));

  // Under service-charge mode the fee is a separate taxed line, matching how these invoices
  // are already raised in Books: travel untaxed, 18% on the fee alone.
  if (input.gstMode === 'service_charge_18') {
    const fee = Number(input.serviceCharge) || 0;
    if (fee <= 0) {
      throw new ZohoMappingError(
        'Service-charge mode needs a service charge amount. Add one to the docket, or choose a different GST mode.',
      );
    }
    line_items.push({
      name: 'SERVICE CHARGE',
      rate: fee,
      quantity: 1,
      tax_id: rates.eighteen,
      hsn_or_sac: TRAVEL_SAC,
    });
  }

  return {
    customer_id: input.customerId,
    date: input.date,
    place_of_supply: placeOfSupply,
    line_items,
    ...(input.dueDate ? { due_date: input.dueDate } : {}),
    ...(input.reference ? { reference_number: input.reference } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.terms ? { terms: input.terms } : {}),
  };
};
