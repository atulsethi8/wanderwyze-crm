// Check harness for docket money totals.
//
//   npx esbuild services/docketTotals.check.mjs --bundle --format=esm --platform=node --outfile=services/docketTotals.check.build.mjs
//   node services/docketTotals.check.build.mjs
import { calculateDocketTotals } from './docketTotals';

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}` +
      (ok ? '' : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`),
  );
};

const docket = ({ flights = [], hotels = [], excursions = [], transfers = [], serviceCharge, invoices = [], payments = [] } = {}) => ({
  itinerary: { flights, hotels, excursions, transfers, ...(serviceCharge ? { serviceCharge } : {}) },
  invoices,
  payments,
});

const flight = (netCost, grossBilled) => ({ passengerDetails: [{ netCost, grossBilled }] });
const item = (netCost, grossBilled) => ({ netCost, grossBilled });

// --- the service charge must be counted, on both sides -------------------------
// This is the bug this module exists to fix: the reports page and the calendar both
// dropped the service charge, which is exactly where the agency's margin sits.
console.log('--- service charge ---');
const withFee = calculateDocketTotals(
  docket({ flights: [flight(90000, 100000)], serviceCharge: { netCost: 0, grossBilled: 1000 } }),
);
check('service charge counted in gross', withFee.grossBilled, 101000);
check('service charge counted in profit', withFee.profit, 11000);

const withFeeCost = calculateDocketTotals(
  docket({ flights: [flight(90000, 100000)], serviceCharge: { netCost: 400, grossBilled: 1000 } }),
);
check('service charge cost counted', withFeeCost.netCost, 90400);
check('profit nets off the fee cost', withFeeCost.profit, 10600);

check('absent service charge is simply zero', calculateDocketTotals(docket({ flights: [flight(90000, 100000)] })).grossBilled, 100000);

// --- invoices add GST, never a second copy of the itinerary ------------------------
// The bug behind this section: a docket with one Rs 56,388 hotel and two saved invoices
// showed a grand total of Rs 1,12,876, because every invoice's subtotal was summed.
console.log('\n--- invoices ---');
const hotelInvoice = (extra = {}) => ({ subtotal: 56388, gstAmount: 0, grandTotal: 56388, ...extra });
const twice = calculateDocketTotals(
  docket({ hotels: [item(52388, 56388)], invoices: [hotelInvoice(), hotelInvoice({ gstAmount: 18, grandTotal: 56406 })] }),
);
check('two invoices for the same hotel are not double counted', twice.netBilled, 56388);
check('profit is the hotel margin', twice.profit, 4000);

const invoiced = calculateDocketTotals(
  docket({
    flights: [flight(90000, 100000)],
    serviceCharge: { netCost: 0, grossBilled: 1000 },
    invoices: [{ subtotal: 101000, gstAmount: 180, grandTotal: 101180 }],
  }),
);
check('GST from the invoice is added to gross', invoiced.grossBilled, 101180);
check('net billed excludes GST', invoiced.netBilled, 101000);
check('profit excludes GST', invoiced.profit, 11000);

const zohoInvoice = (gstAmount, status = 'sent') => ({ subtotal: 1000, gstAmount, grandTotal: 1000 + gstAmount, zoho: { status } });
check(
  'a Zoho invoice supersedes CRM-only invoices',
  calculateDocketTotals(docket({ hotels: [item(0, 1000)], invoices: [{ subtotal: 1000, gstAmount: 50 }, zohoInvoice(180)] })).gst,
  180,
);
check(
  'voided Zoho invoices are ignored',
  calculateDocketTotals(docket({ hotels: [item(0, 1000)], invoices: [zohoInvoice(180, 'void'), zohoInvoice(50)] })).gst,
  50,
);
check(
  'CRM-only invoices count when there is no Zoho invoice',
  calculateDocketTotals(docket({ hotels: [item(0, 1000)], invoices: [{ subtotal: 1000, gstAmount: 50 }] })).grossBilled,
  1050,
);

// --- balance --------------------------------------------------------------------
console.log('\n--- balance ---');
const partPaid = calculateDocketTotals(
  docket({ flights: [flight(0, 100000)], payments: [{ amount: 30000 }, { amount: 20000 }] }),
);
check('payments are summed', partPaid.paid, 50000);
check('balance is billed minus paid', partPaid.balance, 50000);

// The dashboard deliberately shows a negative balance for an overpayment, and its sort
// suite covers that, so this must not be clamped here.
const overpaid = calculateDocketTotals(docket({ flights: [flight(0, 1000)], payments: [{ amount: 1250 }] }));
check('overpayment stays negative', overpaid.balance, -250);

// --- resilience against partial records ------------------------------------------
console.log('\n--- missing and malformed data ---');
check('empty docket totals to zero', calculateDocketTotals(docket()), {
  grossBilled: 0, netBilled: 0, gst: 0, netCost: 0, paid: 0, balance: 0, profit: 0,
});
check(
  'undefined amounts do not produce NaN',
  calculateDocketTotals(docket({ hotels: [item(undefined, undefined)], payments: [{ amount: undefined }] })).grossBilled,
  0,
);
check(
  'a docket with no payments array still works',
  calculateDocketTotals({ itinerary: { flights: [], hotels: [], excursions: [], transfers: [] }, invoices: [] }).paid,
  0,
);

// --- every itinerary section contributes -----------------------------------------
console.log('\n--- all sections counted ---');
const everything = calculateDocketTotals(
  docket({
    flights: [flight(1, 10)],
    hotels: [item(2, 20)],
    excursions: [item(3, 30)],
    transfers: [item(4, 40)],
    serviceCharge: { netCost: 5, grossBilled: 50 },
  }),
);
check('gross covers all five sections', everything.grossBilled, 150);
check('cost covers all five sections', everything.netCost, 15);

console.log(failures ? `\n${failures} FAILING assertion(s)` : '\nAll assertions passed');
process.exit(failures ? 1 : 0);
