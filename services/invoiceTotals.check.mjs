// Check harness for invoice money arithmetic.
//
// Run with:
//   npx esbuild services/invoiceTotals.check.mjs --bundle --format=esm --platform=node --outfile=services/invoiceTotals.check.build.mjs
//   node services/invoiceTotals.check.build.mjs
import { computeInvoiceTotals, halveTax, lineNet, lineTax, lineGross } from './invoiceTotals';

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}` +
      (ok ? '' : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`),
  );
};

const item = (rate, quantity, gstRate) => ({
  id: `l${rate}-${gstRate}`,
  description: 'x',
  quantity,
  rate,
  isGstApplicable: gstRate > 0,
  gstRate: gstRate || 0,
});

// --- mixed slabs must stay separate, never blended -------------------------
const mixed = computeInvoiceTotals([item(10000, 1, 5), item(20000, 1, 18)], {
  gstOnTotal: false,
  gstOnTotalRate: 18,
});
check('mixed: subtotal', mixed.subtotal, 30000);
check('mixed: two slabs kept apart', mixed.gstBreakdown.map(([r]) => r), ['5', '18']);
check('mixed: 5% slab value', mixed.gstBreakdown[0][1].gstValue, 500);
check('mixed: 18% slab value', mixed.gstBreakdown[1][1].gstValue, 3600);
check('mixed: total gst', mixed.gstAmount, 4100);
check('mixed: grand total', mixed.grandTotal, 34100);
// The old code averaged these into a single 13.67% line; the slabs must not be averaged.
check('mixed: no blended slab', mixed.gstBreakdown.length, 2);

// --- same slab across several lines is merged ------------------------------
const merged = computeInvoiceTotals([item(1000, 2, 18), item(500, 1, 18)], {
  gstOnTotal: false,
  gstOnTotalRate: 18,
});
check('merged: single slab', merged.gstBreakdown.length, 1);
check('merged: taxable base', merged.gstBreakdown[0][1].taxableAmount, 2500);
check('merged: gst', merged.gstAmount, 450);

// --- subtotal + gst must equal grand total exactly, including awkward values -
const awkward = computeInvoiceTotals([item(33.335, 3, 18), item(0.005, 1, 5)], {
  gstOnTotal: false,
  gstOnTotalRate: 18,
});
check(
  'awkward: subtotal + gst === grand total',
  round(awkward.subtotal + awkward.gstAmount),
  awkward.grandTotal,
);
function round(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

// A spread of rates and quantities: the identity must hold for all of them.
let identityFailures = 0;
for (const rate of [0.01, 1.005, 12.345, 99.99, 1234.567, 88888.885]) {
  for (const qty of [1, 2, 3, 7, 13]) {
    for (const gst of [5, 12, 18, 28]) {
      const t = computeInvoiceTotals([item(rate, qty, gst)], { gstOnTotal: false, gstOnTotalRate: 18 });
      if (round(t.subtotal + t.gstAmount) !== t.grandTotal) identityFailures++;
    }
  }
}
check('identity holds across 120 rate/qty/slab combinations', identityFailures, 0);

// --- non-taxable items contribute to subtotal but not to any slab ----------
const partial = computeInvoiceTotals([item(1000, 1, 0), item(1000, 1, 18)], {
  gstOnTotal: false,
  gstOnTotalRate: 18,
});
check('partial: subtotal covers both', partial.subtotal, 2000);
check('partial: only taxed line in slab', partial.gstBreakdown[0][1].taxableAmount, 1000);
check('partial: gst on taxed line only', partial.gstAmount, 180);

// --- GST charged on the invoice total -------------------------------------
const onTotal = computeInvoiceTotals([item(1000, 1, 0), item(500, 1, 0)], {
  gstOnTotal: true,
  gstOnTotalRate: 18,
});
check('onTotal: single slab at chosen rate', onTotal.gstBreakdown.map(([r]) => r), ['18']);
check('onTotal: taxes the whole subtotal', onTotal.gstBreakdown[0][1].taxableAmount, 1500);
check('onTotal: gst', onTotal.gstAmount, 270);
check('onTotal: grand total', onTotal.grandTotal, 1770);
check('onTotal: lines carry no tax of their own', lineTax(item(1000, 1, 18), true), 0);
check('onTotal: line gross equals net', lineGross(item(1000, 1, 18), true), 1000);

const zeroRated = computeInvoiceTotals([item(1000, 1, 0)], { gstOnTotal: true, gstOnTotalRate: 0 });
check('onTotal at 0%: no slab row', zeroRated.gstBreakdown.length, 0);
check('onTotal at 0%: grand total is subtotal', zeroRated.grandTotal, 1000);

// --- CGST/SGST split must not lose or invent a paisa ----------------------
check('halveTax: even value', halveTax(180), [90, 90]);
check('halveTax: odd paisa keeps the total', halveTax(0.05), [0.03, 0.02]);
check('halveTax: halves sum back', round(halveTax(4100.01)[0] + halveTax(4100.01)[1]), 4100.01);

let splitFailures = 0;
for (let paise = 1; paise <= 2000; paise++) {
  const value = round(paise / 100);
  const [a, b] = halveTax(value);
  if (round(a + b) !== value) splitFailures++;
}
check('halveTax: sums back for 2000 consecutive paise values', splitFailures, 0);

// --- per-line helpers ------------------------------------------------------
check('lineNet rounds to paise', lineNet(item(33.335, 3, 0)), 100.01);
check('lineTax at 18%', lineTax(item(1000, 1, 18), false), 180);
check('lineGross is net plus tax', lineGross(item(1000, 1, 18), false), 1180);
check('lineNet tolerates blank fields', lineNet({ quantity: '', rate: '' }), 0);

// --- empty invoice ---------------------------------------------------------
const empty = computeInvoiceTotals([], { gstOnTotal: false, gstOnTotalRate: 18 });
check('empty invoice totals to zero', [empty.subtotal, empty.gstAmount, empty.grandTotal], [0, 0, 0]);

console.log(failures ? `\n${failures} FAILING assertion(s)` : '\nAll assertions passed');
process.exit(failures ? 1 : 0);
