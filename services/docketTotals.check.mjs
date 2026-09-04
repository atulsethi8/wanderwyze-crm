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

// --- invoices win over the itinerary estimate ----------------------------------
console.log('\n--- invoices take precedence ---');
const invoiced = calculateDocketTotals(
  docket({
    flights: [flight(90000, 100000)],
    serviceCharge: { netCost: 0, grossBilled: 1000 },
    invoices: [{ grandTotal: 270600, subtotal: 270420 }],
  }),
);
check('gross comes from the invoice', invoiced.grossBilled, 270600);
check('net billed excludes GST', invoiced.netBilled, 270420);
check('cost still comes from the itinerary', invoiced.netCost, 90000);
check('profit uses net billed, not gross', invoiced.profit, 180420);

check(
  'several invoices are summed',
  calculateDocketTotals(docket({ invoices: [{ grandTotal: 100, subtotal: 90 }, { grandTotal: 200, subtotal: 180 }] })).grossBilled,
  300,
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
  grossBilled: 0, netBilled: 0, netCost: 0, paid: 0, balance: 0, profit: 0,
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
