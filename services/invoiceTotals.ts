import { InvoiceLineItem } from '../types';

/**
 * Invoice money arithmetic, kept pure and separate from the generator component so it can be
 * checked directly.
 *
 * Every figure is rounded to paise as it is produced rather than only at display time. If raw
 * floats are summed and each total rounded independently, the printed "Subtotal + GST" can
 * differ from the printed "Grand Total" by a paisa - visible, and awkward on a tax document.
 */

/** Rounds to paise. The epsilon stops values like 1180.005 rounding down through binary error. */
export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** A line's pre-tax value. */
export const lineNet = (item: InvoiceLineItem) =>
  round2((Number(item.quantity) || 0) * (Number(item.rate) || 0));

/** A line's own tax. Zero when GST is charged on the invoice total instead of per line. */
export const lineTax = (item: InvoiceLineItem, gstOnTotal: boolean) => {
  if (gstOnTotal) return 0;
  return item.isGstApplicable && item.gstRate ? round2(lineNet(item) * (item.gstRate / 100)) : 0;
};

export const lineGross = (item: InvoiceLineItem, gstOnTotal: boolean) =>
  round2(lineNet(item) + lineTax(item, gstOnTotal));

export interface GstSlab {
  taxableAmount: number;
  gstValue: number;
}

export interface InvoiceTotals {
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
  /** One entry per GST rate, ascending. A tax invoice must show each slab separately. */
  gstBreakdown: [string, GstSlab][];
}

export const computeInvoiceTotals = (
  lineItems: InvoiceLineItem[],
  options: { gstOnTotal: boolean; gstOnTotalRate: number },
): InvoiceTotals => {
  const subtotal = round2(lineItems.reduce((sum, item) => sum + lineNet(item), 0));
  const slabs: { [rate: string]: GstSlab } = {};

  if (options.gstOnTotal) {
    if (options.gstOnTotalRate > 0) {
      slabs[options.gstOnTotalRate] = {
        taxableAmount: subtotal,
        gstValue: round2(subtotal * (options.gstOnTotalRate / 100)),
      };
    }
  } else {
    for (const item of lineItems) {
      if (!item.isGstApplicable || !(item.gstRate > 0)) continue;
      const taxableAmount = lineNet(item);
      const existing = slabs[item.gstRate] || { taxableAmount: 0, gstValue: 0 };
      slabs[item.gstRate] = {
        taxableAmount: round2(existing.taxableAmount + taxableAmount),
        gstValue: round2(existing.gstValue + taxableAmount * (item.gstRate / 100)),
      };
    }
  }

  const gstBreakdown = Object.entries(slabs).sort((a, b) => Number(a[0]) - Number(b[0]));
  const gstAmount = round2(gstBreakdown.reduce((sum, [, slab]) => sum + slab.gstValue, 0));

  return { subtotal, gstAmount, grandTotal: round2(subtotal + gstAmount), gstBreakdown };
};

/**
 * Splits a tax figure into CGST and SGST without losing a paisa: the second half takes the
 * remainder, so the two always add back to exactly the original.
 */
export const halveTax = (value: number): [number, number] => {
  const half = round2(value / 2);
  return [half, round2(value - half)];
};
