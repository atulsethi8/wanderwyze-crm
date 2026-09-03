import { Docket, InvoiceLineItem } from '../types';

/**
 * Derives an invoice's starting line items from a docket's itinerary: one line per flight
 * (grouped, since a flight already aggregates its passengers), one per hotel, excursion and
 * transfer, plus the service charge if one was recorded. Zero-value items are dropped.
 *
 * Shared between the built-in invoice generator and the Zoho panel so the two cannot drift
 * into deriving different totals from the same docket.
 */
export const deriveDocketLineItems = (docket: Docket): InvoiceLineItem[] => {
  const items: InvoiceLineItem[] = [];
  const stamp = Date.now();

  docket.itinerary.flights.forEach((f) => {
    const paxCount = f.passengerDetails.length;
    if (!paxCount) return;
    const totalGross = f.passengerDetails.reduce((sum, pd) => sum + pd.grossBilled, 0);
    if (totalGross <= 0) return;
    items.push({
      id: `line-${stamp}-flight-${f.id}`,
      description: `Flights: ${f.airline} (${f.departureAirport}-${f.arrivalAirport}) for ${paxCount} passenger(s)`,
      quantity: 1,
      rate: totalGross,
      isGstApplicable: false,
      gstRate: 0,
    });
  });

  docket.itinerary.hotels.forEach((h) => {
    if (h.grossBilled > 0) {
      items.push({
        id: `line-${stamp}-hotel-${h.id}`,
        description: `Hotel: ${h.name}`,
        quantity: 1,
        rate: h.grossBilled,
        isGstApplicable: false,
        gstRate: 0,
      });
    }
  });

  docket.itinerary.excursions.forEach((e) => {
    if (e.grossBilled > 0) {
      items.push({
        id: `line-${stamp}-excursion-${e.id}`,
        description: `Excursion: ${e.name}`,
        quantity: 1,
        rate: e.grossBilled,
        isGstApplicable: false,
        gstRate: 0,
      });
    }
  });

  docket.itinerary.transfers.forEach((t) => {
    if (t.grossBilled > 0) {
      items.push({
        id: `line-${stamp}-transfer-${t.id}`,
        description: `Transfer: ${t.provider}`,
        quantity: 1,
        rate: t.grossBilled,
        isGstApplicable: false,
        gstRate: 0,
      });
    }
  });

  return items;
};

/** The docket's own recorded service charge, if any - the default fee for service-charge mode. */
export const docketServiceCharge = (docket: Docket): number =>
  docket.itinerary.serviceCharge?.grossBilled || 0;
