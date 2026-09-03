// Check harness for the dashboard's booking-queue ordering.
//
// Run with:
//   npx esbuild components/dashboardSort.check.mjs --bundle --format=esm --platform=node --outfile=components/dashboardSort.check.build.mjs
//   node components/dashboardSort.check.build.mjs
import { compareRows } from './dashboardSort';

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}` +
      (ok ? '' : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`),
  );
};

const row = (name, { createdAt = '', travelDate = '', amount = 0, balance = 0, ref = '—', agent } = {}) => ({
  docket: { id: name, docketNo: name, createdAt, status: 'Confirmed' },
  product: { type: 'Flights', text: `trip ${name}` },
  amount,
  balance,
  bookingRef: ref,
  leadTraveller: name,
  travelDate,
  agent: agent ? { id: agent, name: agent } : undefined,
});

const order = (rows, key, direction) =>
  [...rows].sort((a, b) => compareRows(a, b, key, direction)).map((r) => r.leadTraveller);

// --- default ordering: newest booking first --------------------------------
const byCreation = [
  row('oldest', { createdAt: '2026-01-05T10:00:00Z' }),
  row('newest', { createdAt: '2026-03-20T09:00:00Z' }),
  row('middle', { createdAt: '2026-02-11T18:30:00Z' }),
];
check('booking date desc = newest first', order(byCreation, 'bookingDate', 'desc'), [
  'newest',
  'middle',
  'oldest',
]);
check('booking date asc = oldest first', order(byCreation, 'bookingDate', 'asc'), [
  'oldest',
  'middle',
  'newest',
]);

// Same calendar day, different times: the clock time must still decide.
const sameDay = [
  row('morning', { createdAt: '2026-03-20T04:00:00Z' }),
  row('evening', { createdAt: '2026-03-20T21:00:00Z' }),
];
check('same day ordered by time', order(sameDay, 'bookingDate', 'desc'), ['evening', 'morning']);

// --- money sorts numerically, not as text ----------------------------------
const byMoney = [
  row('small', { amount: 9000 }),
  row('large', { amount: 120000 }),
  row('medium', { amount: 45000 }),
];
check('amount desc is numeric', order(byMoney, 'amount', 'desc'), ['large', 'medium', 'small']);
check('amount asc is numeric', order(byMoney, 'amount', 'asc'), ['small', 'medium', 'large']);

// Negative balances (overpaid) must sort below zero, not be treated as blank.
const byBalance = [
  row('owes', { balance: 5000 }),
  row('settled', { balance: 0 }),
  row('overpaid', { balance: -250 }),
];
check('balance desc keeps zero and negatives in order', order(byBalance, 'balance', 'desc'), [
  'owes',
  'settled',
  'overpaid',
]);

// --- rows missing a value sink to the bottom in BOTH directions ------------
const withBlanks = [
  row('noDate', { travelDate: '' }),
  row('later', { travelDate: '2026-09-21' }),
  row('sooner', { travelDate: '2026-09-18' }),
];
check('travel date desc puts blanks last', order(withBlanks, 'travelDate', 'desc'), [
  'later',
  'sooner',
  'noDate',
]);
check('travel date asc also puts blanks last', order(withBlanks, 'travelDate', 'asc'), [
  'sooner',
  'later',
  'noDate',
]);

// An em dash is the rendered form of "no booking reference" and counts as blank.
const withDash = [row('none', { ref: '—' }), row('has', { ref: 'WY6SXP' })];
check('em-dash ref treated as blank', order(withDash, 'bookingRef', 'asc'), ['has', 'none']);

// Unassigned agents sink too.
const byAgent = [row('unassigned'), row('withAgent', { agent: 'Sunita' })];
check('unassigned agent last', order(byAgent, 'agent', 'asc'), ['withAgent', 'unassigned']);

// --- text sorts case-insensitively and numerically-aware -------------------
const byName = [row('zara'), row('Ajay'), row('bhavna')];
check('names sort case-insensitively', order(byName, 'leadTraveller', 'asc'), [
  'Ajay',
  'bhavna',
  'zara',
]);

// Docket numbers are strings but must order 9 < 10, not "10" < "9".
const byDocketNo = [row('9'), row('10'), row('100')];
check('docket numbers order numerically', order(byDocketNo, 'docketNo', 'asc'), ['9', '10', '100']);

console.log(failures ? `\n${failures} FAILING assertion(s)` : '\nAll assertions passed');
process.exit(failures ? 1 : 0);
