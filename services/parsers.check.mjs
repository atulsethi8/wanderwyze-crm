// Check harness for the deterministic document parsers.
//
// Run with:
//   npx esbuild services/parsers.check.mjs --bundle --format=esm --platform=node --outfile=services/parsers.check.build.mjs
//   node services/parsers.check.build.mjs
import { parseETicketText } from './ticketParser';
import { parseHotelVoucherText } from './voucherParser';

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}` +
      (ok ? '' : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`),
  );
};

// ---------------------------------------------------------------- e-tickets

const gdsTicket = [
  'ELECTRONIC TICKET RECEIPT',
  'Booking Reference: HK4T2P        Ticket Number: 0982345678901',
  'PASSENGERS',
  '1. SETHI/ATUL MR',
  '2. SETHI/PRIYA MRS',
  'FLIGHT DETAILS',
  'AI 302   New Delhi (DEL)  15 Jan 2026  09:45   Mumbai (BOM)  15 Jan 2026  12:05',
  'AI 887   Mumbai (BOM)  22 Jan 2026  18:30   New Delhi (DEL)  22 Jan 2026  20:45',
  'Baggage allowance 25 KGS per adult passenger. Fare rules apply.',
].join('\n');

const otaTicket = [
  'IndiGo E-Ticket / Itinerary',
  'PNR: J8K2LM',
  'Booking ID: MMT12345678',
  'Passenger Name: Mr Rohit Sharma',
  'Passenger Name: Ms Anita Rao',
  '6E-1425   DEL - BLR',
  'Departure: 03 Mar 2026 06:15',
  'Arrival: 03 Mar 2026 09:05',
  'Web check-in opens 48 hours before departure.',
].join('\n');

const multiCityTicket = [
  'Airline PNR - QW9ZTR',
  'PASSENGER LIST',
  '1. KHAN/IMRAN MR',
  '2. KHAN/AYAN MSTR (CHD)',
  '3. KHAN/ZARA INF',
  'EK 517  (BOM) 04FEB2026 04:30  (DXB) 04FEB2026 06:00',
  'EK 073  (DXB) 09FEB2026 08:15  (LHR) 09FEB2026 12:40',
  'Terms and conditions of carriage apply to all sectors.',
].join('\n');

const proseOnly = [
  'Travel confirmation for your upcoming journey.',
  'Thank you for booking with us. Your seats are confirmed.',
  'Please arrive at the airport two hours before departure.',
  'Contact our support desk for any changes to this reservation.',
  'Baggage rules and fare conditions are available on our website.',
].join('\n');

const noPnrTicket = [
  'Flight summary',
  'Passenger Name: Mr Vikram Desai',
  'UK 995  Delhi (DEL) 12 Apr 2026 07:00   Goa (GOI) 12 Apr 2026 09:30',
  'Please carry a valid photo identity document.',
].join('\n');

console.log('--- e-ticket parser ---');
const gds = parseETicketText(gdsTicket);
check('GDS pnr', gds?.pnr, 'HK4T2P');
check('GDS trip type', gds?.tripType, 'Return');
check('GDS passenger names', gds?.passengers.map((p) => p.fullName), ['Atul Sethi', 'Priya Sethi']);
check('GDS genders', gds?.passengers.map((p) => p.gender), ['Male', 'Female']);
check('GDS sector count', gds?.sectors.length, 2);
check(
  'GDS outbound',
  gds && [gds.sectors[0].flightNumber, gds.sectors[0].departureAirport, gds.sectors[0].arrivalAirport, gds.sectors[0].departureDate, gds.sectors[0].departureTime],
  ['AI302', 'DEL', 'BOM', '2026-01-15', '09:45'],
);
check('GDS airline name', gds?.sectors[0].airline, 'Air India');

const ota = parseETicketText(otaTicket);
check('OTA pnr', ota?.pnr, 'J8K2LM');
check('OTA trip type', ota?.tripType, 'One Way');
check(
  'OTA sector',
  ota && [ota.sectors[0].flightNumber, ota.sectors[0].departureAirport, ota.sectors[0].arrivalAirport, ota.sectors[0].departureDate, ota.sectors[0].arrivalTime],
  ['6E1425', 'DEL', 'BLR', '2026-03-03', '09:05'],
);
check('OTA passengers', ota?.passengers.map((p) => p.fullName), ['Rohit Sharma', 'Anita Rao']);

const multi = parseETicketText(multiCityTicket);
check('Multi-city trip type', multi?.tripType, 'Multi-City');
check('Multi-city sector count', multi?.sectors.length, 2);
check('Multi-city pax types', multi?.passengers.map((p) => p.passengerType), ['Adult', 'Child', 'Infant']);
check('Multi-city compact date', multi?.sectors[0].departureDate, '2026-02-04');

check('Prose only -> null', parseETicketText(proseOnly), null);
check('No PNR -> null', parseETicketText(noPnrTicket), null);

// A real IndiGo consolidator ticket, reduced to the lines the parser depends on. Reproduces
// the layout that previously failed outright: an airline-qualified PNR, a manifest table
// instead of GDS name lines, and an arrival cell printed above the departure it belongs to.
const indigoManifest = [
  'New Delhi  E-Ticket  PNR: 6E - WY6SXP',
  'Contact No: 9833834836  Issued Date: Wed, 02-Sep-2026 16:32',
  'First Name  Last Name  Passenger Type  E-Ticket Number  Frequent Flyer No.  GST No.',
  'Mr MALLIKARJUNA REDDY  PESALADINNE  Adult  707WY6SXP  --  --',
  'Mr NEERAJ KUMAR  JHA  Adult  707WY6SXP  --  --',
  'Flight Details  Departure  Arrival',
  'Departure Flight',
  'IndiGo 6E 362  HYD  GOI',
  'Economy , Class KF  (Rajiv Gandhi International Airport,  (Dabolim, Goa)',
  'Aircraft 320',
  'Hyderabad)  Fri, 18-Sep-2026 12:35',
  'Fri, 18-Sep-2026 11:20',
  'Return Flight',
  'IndiGo 6E 117  GOI  HYD',
  'Economy , Class PF  (Dabolim, Goa)  (Rajiv Gandhi International Airport,',
  'Aircraft 321',
  'Mon, 21-Sep-2026 17:20  Hyderabad)',
  'Mon, 21-Sep-2026 18:35',
  "Passenger Charter : https://www.goindigo.in/content/dam/Passenger-charter-MoCA-India-Feb-2019.pdf",
].join('\n');

const indigo = parseETicketText(indigoManifest);
check('Real IndiGo: airline-prefixed PNR', indigo?.pnr, 'WY6SXP');
check('Real IndiGo: no column header as bookingId', indigo?.bookingId, '');
check('Real IndiGo: manifest passengers', indigo?.passengers.map((p) => p.fullName), [
  'Mallikarjuna Reddy Pesaladinne',
  'Neeraj Kumar Jha',
]);
check('Real IndiGo: footer URL is not a passenger', indigo?.passengers.length, 2);
check('Real IndiGo: trip type', indigo?.tripType, 'Return');
check(
  'Real IndiGo: outbound times not swapped',
  indigo && [indigo.sectors[0].departureTime, indigo.sectors[0].arrivalTime],
  ['11:20', '12:35'],
);
check(
  'Real IndiGo: outbound route',
  indigo && [indigo.sectors[0].flightNumber, indigo.sectors[0].departureAirport, indigo.sectors[0].arrivalAirport, indigo.sectors[0].departureDate],
  ['6E362', 'HYD', 'GOI', '2026-09-18'],
);
check(
  'Real IndiGo: inbound times preserved',
  indigo && [indigo.sectors[1].departureTime, indigo.sectors[1].arrivalTime],
  ['17:20', '18:35'],
);

// SriLankan: the carrier code is separated by a space rather than a dash.
check('Space-separated airline prefix', parseETicketText([
  'New Delhi  Booking Itinerary  PNR: UL 8VGW2C',
  'Passenger Name  Passenger Type  DOB  Passport',
  'Mr ANIL KRISHNA GUNDALA  Adult',
  'Departure Flight',
  'Sri Lankan Airlines UL 177  CMB  HYD',
  'Sun, 17-Aug-2025 10:40  Hyderabad)',
  'Sun, 17-Aug-2025 12:35',
].join('\n'))?.pnr, '8VGW2C');

// A long record locator must not lose its first two characters to the prefix skip.
check('Eight-character PNR kept whole', parseETicketText([
  'Wander Wyze Holidays  E-Ticket  PNR: ABCDEFGH',
  'Contact No: 9833834836  Issued Date: Wed, 02-Sep-2026 16:32',
  'First Name  Last Name  Passenger Type  E-Ticket Number',
  'Mr TEST  PASSENGER  Adult  707ABCDEFG  --  --',
  'Flight Details  Departure  Arrival',
  'Air India AI 302  DEL  BOM',
  'Fri, 18-Sep-2026 11:20',
  'Fri, 18-Sep-2026 12:35',
].join('\n'))?.pnr, 'ABCDEFGH');

// ------------------------------------------------------------ hotel vouchers

const labelledVoucher = [
  'HOTEL BOOKING VOUCHER',
  'Confirmation Number: HTL-99213',
  'Hotel Name: The Grand Palace',
  'Address: 12 Marine Drive, Colombo, Sri Lanka',
  'Guest Name: Mr Atul Sethi',
  'Guest Name: Mrs Priya Sethi',
  'Check-in: 15 Jan 2026',
  'Check-out: 19 Jan 2026',
  'No. of Rooms: 2',
  'Room Type: Deluxe Sea View',
  'Meal Plan: Bed & Breakfast',
  'Remarks: Late arrival, hold room until 22:00',
].join('\n');

const codedVoucher = [
  'ACCOMMODATION VOUCHER',
  'Property: Sunset Beach Resort',
  'City: Phuket',
  'Country: Thailand',
  'Voucher No: SB/2026/4471',
  'Guest: Mr Rohit Sharma',
  'Arrival Date: 02/03/2026',
  'Departure Date: 06/03/2026',
  '3 Rooms',
  'Board Basis: HB',
].join('\n');

const vagueVoucher = [
  'Thank you for your reservation with our property.',
  'We look forward to welcoming you and hope you enjoy your stay.',
  'Please contact the front desk should you require any assistance.',
  'Our cancellation policy is available on request from reception.',
].join('\n');

console.log('\n--- hotel voucher parser ---');
const v1 = parseHotelVoucherText(labelledVoucher);
check('Voucher hotel name', v1?.hotel.name, 'The Grand Palace');
check('Voucher dates', v1 && [v1.hotel.checkIn, v1.hotel.checkOut], ['2026-01-15', '2026-01-19']);
check('Voucher confirmation', v1?.hotel.confirmationNumber, 'HTL-99213');
check('Voucher city/country', v1 && [v1.hotel.city, v1.hotel.country], ['Colombo', 'Sri Lanka']);
check('Voucher rooms', v1?.hotel.numberOfRooms, 2);
check('Voucher meal plan', v1?.hotel.mealPlan, 'Bed & Breakfast');
check('Voucher guests', v1?.passengers.map((g) => g.fullName), ['Atul Sethi', 'Priya Sethi']);

const v2 = parseHotelVoucherText(codedVoucher);
check('Coded voucher name', v2?.hotel.name, 'Sunset Beach Resort');
check('Coded voucher city/country', v2 && [v2.hotel.city, v2.hotel.country], ['Phuket', 'Thailand']);
check('Coded voucher numeric dates', v2 && [v2.hotel.checkIn, v2.hotel.checkOut], ['2026-03-02', '2026-03-06']);
check('Coded voucher rooms', v2?.hotel.numberOfRooms, 3);
check('Coded voucher meal code HB', v2?.hotel.mealPlan, 'Half Board');

check('Vague voucher -> null', parseHotelVoucherText(vagueVoucher), null);

console.log(failures ? `\n${failures} FAILING assertion(s)` : '\nAll assertions passed');
process.exit(failures ? 1 : 0);
