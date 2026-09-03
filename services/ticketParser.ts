import { titleCase, findDates, findTimes } from './parseUtils';

/**
 * Deterministic e-ticket parsing.
 *
 * E-tickets emitted by GDS systems (Amadeus, Sabre, Galileo) and by the major OTAs follow
 * tight, recognisable conventions, so they can be read straight out of the PDF text layer.
 *
 * Anything this parser cannot read *completely* is rejected by returning null; the caller
 * then keeps the attached PDF and asks for manual entry. A partial or guessed fill would be
 * worse than no fill, since an agent is unlikely to notice a silently wrong date or PNR.
 */

export interface ParsedSector {
  airline: string;
  flightNumber: string;
  departureDate: string;
  departureTime: string;
  departureAirport: string;
  arrivalDate: string;
  arrivalTime: string;
  arrivalAirport: string;
}

export interface ParsedPassenger {
  fullName: string;
  passengerType: string;
  gender: string;
}

export interface ParsedTicket {
  tripType: string;
  pnr: string;
  bookingId: string;
  passengers: ParsedPassenger[];
  sectors: ParsedSector[];
}

// --- Lookup tables -----------------------------------------------------------------

const AIRLINE_NAMES: Record<string, string> = {
  AI: 'Air India', IX: 'Air India Express', '6E': 'IndiGo', UK: 'Vistara',
  SG: 'SpiceJet', QP: 'Akasa Air', G8: 'Go First', I5: 'AIX Connect',
  EK: 'Emirates', FZ: 'flydubai', QR: 'Qatar Airways', EY: 'Etihad Airways',
  SV: 'Saudia', GF: 'Gulf Air', WY: 'Oman Air', KU: 'Kuwait Airways', G9: 'Air Arabia',
  SQ: 'Singapore Airlines', TG: 'Thai Airways', MH: 'Malaysia Airlines', AK: 'AirAsia',
  D7: 'AirAsia X', CX: 'Cathay Pacific', VN: 'Vietnam Airlines', VJ: 'VietJet Air',
  UL: 'SriLankan Airlines', BG: 'Biman Bangladesh', RA: 'Nepal Airlines',
  JL: 'Japan Airlines', NH: 'ANA', KE: 'Korean Air', OZ: 'Asiana Airlines',
  CA: 'Air China', MU: 'China Eastern', CZ: 'China Southern', BR: 'EVA Air', CI: 'China Airlines',
  BA: 'British Airways', VS: 'Virgin Atlantic', LH: 'Lufthansa', AF: 'Air France',
  KL: 'KLM', LX: 'Swiss', OS: 'Austrian Airlines', SN: 'Brussels Airlines',
  IB: 'Iberia', AY: 'Finnair', SK: 'SAS', LO: 'LOT Polish Airlines', A3: 'Aegean Airlines',
  TK: 'Turkish Airlines', MS: 'EgyptAir', RJ: 'Royal Jordanian', ME: 'Middle East Airlines',
  ET: 'Ethiopian Airlines', KQ: 'Kenya Airways', SA: 'South African Airways',
  UA: 'United Airlines', AA: 'American Airlines', DL: 'Delta Air Lines', AC: 'Air Canada',
  QF: 'Qantas', NZ: 'Air New Zealand', PR: 'Philippine Airlines', GA: 'Garuda Indonesia',
};

/** Three-letter uppercase tokens that turn up in ticket prose but are not airports. */
const NOT_AIRPORTS = new Set([
  'PNR', 'GST', 'INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'PDF', 'ALL', 'AND',
  'THE', 'FOR', 'NOT', 'MAY', 'CAN', 'YOU', 'ARE', 'WAS', 'HAS', 'ANY', 'PER', 'VIA',
  'NEW', 'OLD', 'ETA', 'ETD', 'ARR', 'DEP', 'BAG', 'KGS', 'HRS', 'MIN', 'NON', 'ONE',
  'TWO', 'SIX', 'TEN', 'AIR', 'FLT', 'SEQ', 'CLS', 'FEE', 'TAX', 'NET', 'SUB', 'TTL',
  'ADT', 'CHD', 'INF', 'MRS', 'MST', 'DOB', 'ADD', 'TEL', 'FAX', 'REF', 'NUM', 'NIL',
]);

/** Airport codes, preferring the unambiguous parenthesised form printed by most issuers. */
const findAirports = (text: string): string[] => {
  const parenthesised = [...text.matchAll(/\(([A-Z]{3})\)/g)].map((m) => m[1]);
  if (parenthesised.length >= 2) return parenthesised;

  const paired = [...text.matchAll(/\b([A-Z]{3})\b\s*(?:-|–|—|→|>|to\b)\s*\b([A-Z]{3})\b/g)];
  if (paired.length) return paired.flatMap((m) => [m[1], m[2]]);

  if (parenthesised.length) return parenthesised;

  return [...text.matchAll(/\b([A-Z]{3})\b/g)]
    .map((m) => m[1])
    .filter((code) => !NOT_AIRPORTS.has(code));
};

/** Two-character airline code plus 1-4 digits: AI 302, 6E-1425, UK101. */
const FLIGHT_PATTERN = /\b([A-Z][A-Z0-9]|\d[A-Z])\s*[-–]?\s*(\d{1,4})(?![\d-])\b/;

const findPnr = (text: string): string => {
  const labelled = text.match(
    // Carriers often qualify the record with their own code first: "PNR: 6E - WY6SXP" or
    // "PNR: UL 8VGW2C". That prefix is skipped only when a dash or space separates it, which
    // cannot occur inside a contiguous record locator - so an 8-character "PNR: ABCDEFGH"
    // is still captured whole instead of losing its first two characters.
    /(?:PNR|Booking\s*Ref(?:erence)?|Record\s*Locator|Reservation\s*(?:Code|Number)|Airline\s*PNR|Confirmation\s*(?:No|Number|Code))\s*(?:No\.?|Number|#)?\s*[:\-]?\s*(?:[A-Z0-9]{2}(?:\s*[-–]\s*|\s+))?([A-Z0-9]{5,8})\b/i,
  );
  if (!labelled) return '';
  const candidate = labelled[1].toUpperCase();
  // A PNR always mixes in at least one letter; a bare run of digits is a ticket or order number.
  return /[A-Z]/.test(candidate) ? candidate : '';
};

const findBookingId = (text: string): string => {
  const labelled = text.match(
    /(?:Booking\s*(?:ID|No\.?|Number)|Order\s*(?:ID|No\.?|Number)|Ticket\s*(?:No\.?|Number))\s*[:\-]?\s*([A-Z0-9-]{6,20})\b/i,
  );
  if (!labelled) return '';
  const candidate = labelled[1].toUpperCase();
  // Reference numbers always carry a digit. Without this the label matches a neighbouring
  // column header - "E-Ticket Number  Frequent Flyer No." yields the word FREQUENT.
  return /\d/.test(candidate) ? candidate : '';
};

// --- Passengers --------------------------------------------------------------------

const genderFromTitle = (title?: string): string => {
  const value = (title || '').toUpperCase();
  if (['MR', 'MSTR', 'MASTER'].includes(value)) return 'Male';
  if (['MRS', 'MS', 'MISS'].includes(value)) return 'Female';
  return 'Other';
};

const typeFromTitleAndLine = (title: string | undefined, line: string): string => {
  const value = (title || '').toUpperCase();
  if (/\b(?:INF|INFANT)\b/i.test(line) || value === 'INF') return 'Infant';
  if (/\b(?:CHD|CHILD)\b/i.test(line) || ['MSTR', 'MASTER'].includes(value)) return 'Child';
  return 'Adult';
};

/** Reads the GDS `SURNAME/GIVENNAME TITLE` convention plus the labelled forms used by OTAs. */
const findPassengers = (lines: string[]): ParsedPassenger[] => {
  const passengers: ParsedPassenger[] = [];
  const seen = new Set<string>();

  const add = (given: string, surname: string, title: string | undefined, line: string) => {
    const fullName = titleCase(`${given} ${surname}`.trim());
    const key = fullName.toLowerCase();
    if (fullName.length < 3 || seen.has(key)) return;
    seen.add(key);
    passengers.push({
      fullName,
      passengerType: typeFromTitleAndLine(title, line),
      gender: genderFromTitle(title),
    });
  };

  for (const line of lines) {
    // SETHI/ATUL MR   |   1. SETHI/ATUL KUMAR MR (Adult)
    const gds = line.match(
      /(?:^|\s)(?:\d+[.)]\s*)?([A-Z][A-Z'\- ]{1,30}?)\s*\/\s*([A-Z][A-Z'\- ]{1,30}?)\s+(MR|MRS|MS|MISS|MSTR|MASTER|DR|INF|CHD)\b/,
    );
    if (gds) {
      add(gds[2], gds[1], gds[3], line);
      continue;
    }

    // Airline manifest table: "Mr MALLIKARJUNA REDDY  PESALADINNE  Adult  707WY6SXP  --  --".
    // The title opens the row and the passenger-type column closes the name, so the column
    // gaps between given and family name are simply collapsed.
    const manifest = line.match(
      /^(MR|MRS|MS|MISS|MSTR|MASTER|DR)\.?\s+([A-Z][A-Z'\- ]{2,60}?)\s{2,}(Adult|Child|Infant)\b/i,
    );
    if (manifest) {
      add(manifest[2].replace(/\s+/g, ' '), '', manifest[1], `${manifest[1]} ${manifest[3]}`);
      continue;
    }

    // Passenger Name: Mr Atul Sethi   |   Traveller 1 - ATUL SETHI (Adult)
    // Anchored to the line start: unanchored, "Passenger-charter-MoCA-India-Feb-2019.pdf"
    // in a footer URL parses as a passenger named "Charter-Moca-India-Feb-".
    const labelled = line.match(
      /^(?:Passenger|Traveller|Traveler|Guest)(?:\s*Name)?\s*\d*\s*[:\-]\s*(?:(MR|MRS|MS|MISS|MSTR|MASTER|DR)\.?\s+)?([A-Za-z][A-Za-z'\- ]{2,40})/i,
    );
    if (labelled) {
      const name = labelled[2].replace(/\s*\((?:adult|child|infant)\).*$/i, '').trim();
      add(name, '', labelled[1], line);
    }
  }

  return passengers;
};

const toLines = (text: string): string[] =>
  text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

/**
 * A sector's departure necessarily precedes its arrival, but the two are not always printed
 * in that order: pdf.js emits runs by baseline, so a tabular ticket can place the arrival
 * cell on a higher line than the departure it belongs to. Sorting restores the real order.
 */
const orderChronologically = (values: string[]): string[] =>
  values.length === 2 && values[0] > values[1] ? [values[1], values[0]] : values;

/**
 * Times can only be reordered once the dates are known to match - on an overnight sector the
 * departure time is legitimately the later clock time, so sorting there would corrupt it.
 */
const orderTimesForSameDay = (times: string[], sameDay: boolean): string[] =>
  sameDay ? orderChronologically(times) : times;

// --- Sectors -----------------------------------------------------------------------

const findSectors = (lines: string[]): ParsedSector[] => {
  // Each flight-number line opens a sector; that sector's details run until the next one.
  const anchors = lines
    .map((line, index) => ({ index, match: line.match(FLIGHT_PATTERN) }))
    .filter((entry): entry is { index: number; match: RegExpMatchArray } => Boolean(entry.match));

  const sectors: ParsedSector[] = [];
  const seen = new Set<string>();

  anchors.forEach((anchor, position) => {
    const nextAnchor = anchors[position + 1]?.index ?? lines.length;
    // Cap the window so trailing fare rules and terms do not bleed into the sector.
    const window = lines.slice(anchor.index, Math.min(nextAnchor, anchor.index + 6)).join('\n');

    const airports = findAirports(window);
    if (airports.length < 2) return;

    const dates = orderChronologically(findDates(window));
    const times = findTimes(window);
    const code = anchor.match[1];
    const flightNumber = `${code}${anchor.match[2]}`;

    const key = `${flightNumber}|${airports[0]}|${airports[1]}|${dates[0] || ''}`;
    if (seen.has(key)) return;
    seen.add(key);

    const departureDate = dates[0] || '';
    // A sector listing a single date arrives the same day.
    const arrivalDate = dates[1] || dates[0] || '';
    const ordered = orderTimesForSameDay(times, departureDate === arrivalDate);

    sectors.push({
      airline: AIRLINE_NAMES[code] || code,
      flightNumber,
      departureAirport: airports[0],
      arrivalAirport: airports[1],
      departureDate,
      arrivalDate,
      departureTime: ordered[0] || '',
      arrivalTime: ordered[1] || '',
    });
  });

  return sectors;
};

const detectTripType = (sectors: ParsedSector[]): string => {
  if (sectors.length <= 1) return 'One Way';
  const first = sectors[0];
  const last = sectors[sectors.length - 1];
  return last.arrivalAirport === first.departureAirport ? 'Return' : 'Multi-City';
};

// --- Entry point -------------------------------------------------------------------

/**
 * Returns a fully-formed ticket, or null when anything essential is missing or unreadable.
 * Null means "let the model handle it" — never a partial fill.
 */
export const parseETicketText = (text: string): ParsedTicket | null => {
  if (!text || text.length < 120) return null;

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const sectors = findSectors(lines);
  const passengers = findPassengers(lines);
  const pnr = findPnr(text);

  const everySectorComplete = sectors.every(
    (sector) =>
      sector.flightNumber && sector.departureAirport && sector.arrivalAirport && sector.departureDate,
  );

  if (!pnr || !sectors.length || !passengers.length || !everySectorComplete) return null;

  return {
    tripType: detectTripType(sectors),
    pnr,
    bookingId: findBookingId(text),
    passengers,
    sectors,
  };
};

/**
 * Diagnostic hook for the offline check harness and inspect-pdf.mjs: exposes each field
 * separately so a rejected document shows which gate failed rather than just null.
 */
export const __debug = (text: string) => {
  const lines = toLines(text);
  return {
    pnr: findPnr(text),
    bookingId: findBookingId(text),
    passengers: findPassengers(lines),
    sectors: findSectors(lines),
  };
};
