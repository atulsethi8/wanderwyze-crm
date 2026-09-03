// Check harness for the docket -> Zoho Books invoice mapping.
//
//   npx esbuild services/zohoInvoice.check.mjs --bundle --format=esm --platform=node --outfile=services/zohoInvoice.check.build.mjs
//   node services/zohoInvoice.check.build.mjs
import {
  buildZohoInvoice,
  availableGstModes,
  toStateCode,
  isB2B,
  WANDERWYZE_TAXES as T,
} from './zohoInvoice';

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}` +
      (ok ? '' : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`),
  );
};
const throws = (label, fn, fragment) => {
  try {
    fn();
    failures++;
    console.log(`FAIL  ${label} — expected an error, none thrown`);
  } catch (e) {
    const ok = e.message.toLowerCase().includes(fragment.toLowerCase());
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` — message was "${e.message}"`}`);
  }
};

const line = (description, rate, quantity = 1) => ({
  id: description,
  description,
  quantity,
  rate,
  isGstApplicable: false,
  gstRate: 0,
});

// --- state codes ----------------------------------------------------------
console.log('--- state codes ---');
check('full name to code', toStateCode('Telangana'), 'TS');
check('case insensitive', toStateCode('telangana'), 'TS');
check('already a code passes through', toStateCode('TS'), 'TS');
check('home state', toStateCode('Delhi'), 'DL');
check('unknown yields empty', toStateCode('Atlantis'), '');
check('blank yields empty', toStateCode(''), '');

// --- mode availability ----------------------------------------------------
console.log('\n--- GST mode availability ---');
check('registered business is B2B', isB2B('business_gst'), true);
check('composition dealer is B2B', isB2B('business_registered_composition'), true);
check('consumer is not B2B', isB2B('consumer'), false);
check('unset is not B2B', isB2B(undefined), false);
check('B2B may use 5% package', availableGstModes('business_gst'), [
  'service_charge_18',
  'package_5',
  'none',
]);
check('B2C may not use 5% package', availableGstModes('consumer'), ['service_charge_18', 'none']);

// --- service-charge mode, reproducing INV-000137 --------------------------
// Real invoice: place of supply TS, travel 269,420 untaxed, SERVICE CHARGE 1,000 at IGST18.
console.log('\n--- service charge 18% (inter-state, as INV-000137) ---');
const sc = buildZohoInvoice({
  customerId: 'CUST1',
  date: '2026-09-03',
  placeOfSupply: 'Telangana',
  lineItems: [line('Flights: IndiGo (HYD-GOI) for 5 passengers', 269420)],
  serviceCharge: 1000,
  gstMode: 'service_charge_18',
  gstTreatment: 'business_gst',
  reference: '00204',
});
check('place of supply is a code', sc.place_of_supply, 'TS');
check('two lines', sc.line_items.length, 2);
check('travel line carries no tax', sc.line_items[0].tax_id, undefined);
check('travel rate preserved', sc.line_items[0].rate, 269420);
check('fee line is named SERVICE CHARGE', sc.line_items[1].name, 'SERVICE CHARGE');
check('fee taxed at inter-state 18%', sc.line_items[1].tax_id, T.inter.eighteen);
check('fee carries the travel SAC', sc.line_items[1].hsn_or_sac, '998555');
check('docket number travels as reference', sc.reference_number, '00204');

// --- intra-state uses the CGST+SGST group, not IGST -----------------------
console.log('\n--- intra-state (Delhi) ---');
const intra = buildZohoInvoice({
  customerId: 'CUST1',
  date: '2026-09-03',
  placeOfSupply: 'Delhi',
  lineItems: [line('Hotel: Taj', 50000)],
  serviceCharge: 2000,
  gstMode: 'service_charge_18',
  gstTreatment: 'consumer',
});
check('intra-state fee uses the tax group', intra.line_items[1].tax_id, T.intra.eighteen);
check('group differs from IGST', intra.line_items[1].tax_id !== T.inter.eighteen, true);

// --- package 5% mode, as INV-000133 ---------------------------------------
console.log('\n--- package 5% (B2B only) ---');
const pkg = buildZohoInvoice({
  customerId: 'CUST2',
  date: '2026-04-06',
  placeOfSupply: 'Haryana',
  lineItems: [line('Flights', 100000), line('Hotels', 208357)],
  gstMode: 'package_5',
  gstTreatment: 'business_gst',
});
check('every travel line taxed at 5%', pkg.line_items.map((l) => l.tax_id), [
  T.inter.five,
  T.inter.five,
]);
check('no service charge line added', pkg.line_items.length, 2);

// The rule that matters: 5% is not available to a consumer.
throws(
  'package 5% rejected for a consumer',
  () =>
    buildZohoInvoice({
      customerId: 'C',
      date: '2026-04-06',
      placeOfSupply: 'Haryana',
      lineItems: [line('Flights', 100000)],
      gstMode: 'package_5',
      gstTreatment: 'consumer',
    }),
  'registered business',
);
throws(
  'package 5% rejected when treatment unknown',
  () =>
    buildZohoInvoice({
      customerId: 'C',
      date: '2026-04-06',
      placeOfSupply: 'Haryana',
      lineItems: [line('Flights', 100000)],
      gstMode: 'package_5',
    }),
  'registered business',
);

// --- no-GST mode, as INV-000136 -------------------------------------------
console.log('\n--- no GST ---');
const none = buildZohoInvoice({
  customerId: 'C',
  date: '2026-08-29',
  placeOfSupply: 'Chandigarh',
  lineItems: [line('Flights', 192640)],
  gstMode: 'none',
  gstTreatment: 'consumer',
});
check('no tax on any line', none.line_items.every((l) => !l.tax_id), true);
check('chandigarh code', none.place_of_supply, 'CH');

// --- guards ---------------------------------------------------------------
console.log('\n--- guards ---');
throws(
  'unknown state rejected before hitting the API',
  () =>
    buildZohoInvoice({
      customerId: 'C',
      date: '2026-09-03',
      placeOfSupply: 'Bengaluru',
      lineItems: [line('Flights', 1000)],
      gstMode: 'none',
    }),
  'not a recognised indian state',
);
throws(
  'missing customer rejected',
  () =>
    buildZohoInvoice({
      customerId: '',
      date: '2026-09-03',
      placeOfSupply: 'Delhi',
      lineItems: [line('Flights', 1000)],
      gstMode: 'none',
    }),
  'customer must be matched',
);
throws(
  'service-charge mode without a fee rejected',
  () =>
    buildZohoInvoice({
      customerId: 'C',
      date: '2026-09-03',
      placeOfSupply: 'Delhi',
      lineItems: [line('Flights', 1000)],
      gstMode: 'service_charge_18',
      gstTreatment: 'consumer',
    }),
  'needs a service charge',
);
throws(
  'empty invoice rejected',
  () =>
    buildZohoInvoice({
      customerId: 'C',
      date: '2026-09-03',
      placeOfSupply: 'Delhi',
      lineItems: [line('Zero value', 0)],
      gstMode: 'none',
    }),
  'no line items',
);

console.log(failures ? `\n${failures} FAILING assertion(s)` : '\nAll assertions passed');
process.exit(failures ? 1 : 0);
