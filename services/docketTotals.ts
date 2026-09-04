import { Docket } from '../types';

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
  /** What the client is billed, tax included. Invoices win when they exist. */
  grossBilled: number;
  /** Billed excluding GST. Equal to grossBilled when there are no invoices to break it out. */
  netBilled: number;
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

export const calculateDocketTotals = (docket: Docket): DocketTotals => {
  const invoices = docket.invoices || [];
  const hasInvoices = invoices.length > 0;

  // An invoice is the authoritative record of what was billed; the itinerary is the estimate
  // standing in until one exists.
  const grossBilled = hasInvoices
    ? sum(invoices.map((invoice) => invoice.grandTotal))
    : itineraryGross(docket);

  // Itinerary figures carry no GST of their own, so gross and net are the same until an
  // invoice separates them.
  const netBilled = hasInvoices ? sum(invoices.map((invoice) => invoice.subtotal)) : grossBilled;

  const netCost = itineraryNetCost(docket);
  const paid = sum((docket.payments || []).map((payment) => payment.amount));

  return {
    grossBilled,
    netBilled,
    netCost,
    paid,
    balance: grossBilled - paid,
    profit: netBilled - netCost,
  };
};
