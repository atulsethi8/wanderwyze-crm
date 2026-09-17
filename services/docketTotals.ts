import { Docket, Invoice } from '../types';

/**
 * What a docket is worth, answered once.
 *
 * This existed in three places with three different answers: the dashboard counted the
 * service charge and preferred invoices, the reports page counted neither the service charge
 * nor its cost, and the calendar ignored invoices entirely as well. The same booking
 * therefore showed different revenue, profit and balance depending on which screen you were
 * on - and since the agency's most common billing model puts its whole margin in the service
 * charge, that omission fell precisely where the profit is.
 */

export interface DocketTotals {
  /** What the client is billed, tax included. */
  grossBilled: number;
  /** Billed excluding GST: the itinerary's gross figures. */
  netBilled: number;
  /** GST charged on the invoices that count (see `billableInvoices`). */
  gst: number;
  /** What the trip cost the agency, from the itinerary. */
  netCost: number;
  paid: number;
  /** Negative when the client has overpaid; clamp at the call site if that matters. */
  balance: number;
  /** Margin on the sale, excluding GST collected on the client's behalf. */
  profit: number;
}

const sum = (values: number[]) => values.reduce((total, value) => total + (value || 0), 0);

/** Gross value of every itinerary component, including the service charge. */
const itineraryGross = (docket: Docket): number =>
  sum([
    ...docket.itinerary.flights.flatMap((f) => f.passengerDetails.map((p) => p.grossBilled)),
    ...docket.itinerary.hotels.map((h) => h.grossBilled),
    ...docket.itinerary.excursions.map((e) => e.grossBilled),
    ...docket.itinerary.transfers.map((t) => t.grossBilled),
    docket.itinerary.serviceCharge?.grossBilled || 0,
  ]);

/** Cost of every itinerary component, including the service charge. */
const itineraryNetCost = (docket: Docket): number =>
  sum([
    ...docket.itinerary.flights.flatMap((f) => f.passengerDetails.map((p) => p.netCost)),
    ...docket.itinerary.hotels.map((h) => h.netCost),
    ...docket.itinerary.excursions.map((e) => e.netCost),
    ...docket.itinerary.transfers.map((t) => t.netCost),
    docket.itinerary.serviceCharge?.netCost || 0,
  ]);

/**
 * The invoices whose GST counts towards the docket.
 *
 * Invoices document the itinerary rather than adding to it, and the same trip is routinely
 * invoiced more than once - a CRM invoice first, then the real one in Zoho Books. Once any
 * Zoho invoice exists, CRM-only invoices are treated as superseded drafts; voided Zoho
 * invoices never count.
 */
export const billableInvoices = (invoices: Invoice[] = []): Invoice[] => {
  const zoho = invoices.filter((invoice) => invoice.zoho && invoice.zoho.status?.toLowerCase() !== 'void');
  if (invoices.some((invoice) => invoice.zoho)) return zoho;
  return invoices;
};

export const calculateDocketTotals = (docket: Docket): DocketTotals => {
  // Billed amounts come from the itinerary, never by adding invoice totals together: summing
  // invoices double counts whenever a docket has been invoiced twice.
  const netBilled = itineraryGross(docket);
  const gst = sum(billableInvoices(docket.invoices).map((invoice) => invoice.gstAmount));
  const grossBilled = netBilled + gst;

  const netCost = itineraryNetCost(docket);
  const paid = sum((docket.payments || []).map((payment) => payment.amount));

  return {
    grossBilled,
    netBilled,
    gst,
    netCost,
    paid,
    balance: grossBilled - paid,
    profit: netBilled - netCost,
  };
};
