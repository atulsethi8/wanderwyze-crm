import { titleCase, findLabelled, findLabelledDate, findDates } from './parseUtils';

/**
 * Deterministic hotel-voucher parsing.
 *
 * Vouchers vary far more between chains and consolidators than e-tickets do, so this reads
 * the labelled fields they reliably share (property, confirmation number, check-in/out) and
 * gives up rather than guessing at the rest. As with the ticket parser, returning null means
 * "keep the PDF attached and let the agent type it in".
 */

export interface ParsedGuest {
  fullName: string;
}

export interface ParsedHotel {
  name: string;
  city: string;
  country: string;
  confirmationNumber: string;
  checkIn: string;
  checkOut: string;
  numberOfRooms: number;
  roomType: string;
  mealPlan: string;
  remarks: string;
}

export interface ParsedVoucher {
  passengers: ParsedGuest[];
  hotel: ParsedHotel;
}

/**
 * Consolidators stamp the agent's account number across every page as a watermark, and
 * pdf.js reads it back as text scattered through the lines, whole or clipped ("51137285",
 * "5113728", "37285"). It is recognisable as the one long number repeated far more often than
 * any real value on a voucher, so every digit run that is part of it is removed.
 */
const stripWatermark = (lines: string[]): string[] => {
  const counts = new Map<string, number>();
  for (const line of lines) {
    for (const token of line.match(/\b\d{6,}\b/g) || []) counts.set(token, (counts.get(token) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 10) return lines;
  const watermark = top[0];

  return lines
    .map((line) =>
      line
        .replace(/(^|\s)(\d{3,})(?=\s|$)/g, (whole, lead, digits) => (watermark.includes(digits) ? lead : whole))
        .replace(/\s+$/, ''),
    )
    .filter((line) => line.trim().length > 0);
};

/**
 * Tabular vouchers (TripJack among them) wrap a date across two lines inside a narrow
 * column: "17-09-  19-09-" followed by "2026  2026". Rejoin each fragment with its year.
 */
const joinWrappedDates = (lines: string[]): string[] => {
  const fragment = /\b(\d{1,2}[-/.]\d{1,2}[-/.])(?=\s|$)/g;
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const fragments = lines[i].match(fragment);
    const next = lines[i + 1]?.trim() ?? '';
    const years = /^\d{4}(?:\s+\d{4})*$/.test(next) ? next.split(/\s+/) : null;
    if (fragments && years && fragments.length === years.length) {
      let n = 0;
      out.push(lines[i].replace(fragment, (part) => part + years[n++]));
      i++;
      continue;
    }
    out.push(lines[i]);
  }
  return out;
};

const HOTEL_WORDS = /\b(?:hotel|resort|residences?|suites?|inn|lodge|villas?|palace|retreat|hostel|homestay|camp)\b/i;

/**
 * Some vouchers print the property name as a bare heading with no label. Look just below the
 * booking reference first (where TripJack puts it), then for any short line naming a
 * property type.
 */
const findUnlabelledName = (lines: string[]): { name: string; index: number } => {
  const isCandidate = (line: string) =>
    line.length >= 4 && line.length <= 80 && !/[:@]/.test(line) && HOTEL_WORDS.test(line);

  const refIndex = lines.findIndex((line) => /Booking\s*(?:ID|Ref|No)|Confirmation\s*(?:No|Number)/i.test(line));
  if (refIndex >= 0) {
    for (let i = refIndex + 1; i <= refIndex + 2 && i < lines.length; i++) {
      if (isCandidate(lines[i])) return { name: lines[i], index: i };
    }
  }
  const index = lines.findIndex((line) => isCandidate(line) && !/voucher|booking|polic/i.test(line));
  return index >= 0 ? { name: lines[index], index } : { name: '', index: -1 };
};

/** "Mumbai , Maharashtra , India. Postal Code: 400055", printed a few lines under the name. */
const findLocationNear = (lines: string[], index: number): { city: string; country: string } => {
  for (const line of lines.slice(index + 1, index + 5)) {
    const cleaned = line.replace(/\.?\s*(?:Postal|Pin|Zip)\s*Code.*$/i, '').replace(/\.$/, '');
    const parts = cleaned.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 3 && parts.every((part) => /^[A-Za-z .'-]{2,40}$/.test(part))) {
      return { city: titleCase(parts[0]), country: titleCase(parts[parts.length - 1]) };
    }
  }
  return { city: '', country: '' };
};

/** Meal plans appear either spelled out or as trade codes. */
const MEAL_PLANS: [RegExp, string][] = [
  [/\ball\s*inclusive\b|\bAI\b/i, 'All Inclusive'],
  [/\bfull\s*board\b|\bFB\b/i, 'Full Board'],
  [/\bhalf\s*board\b|\bHB\b/i, 'Half Board'],
  [/\bbed\s*(?:and|&)\s*breakfast\b|\bbreakfast\s*included\b|\bBB\b/i, 'Bed & Breakfast'],
  [/\broom\s*only\b|\bno\s*meals\b|\bRO\b/i, 'Room Only'],
];

const findMealPlan = (text: string): string => {
  const labelled = findLabelled(text, /Meal\s*Plan|Board\s*Basis|Incl(?:usions?)?/);
  const haystack = labelled || text;
  for (const [pattern, label] of MEAL_PLANS) {
    if (pattern.test(haystack)) return label;
  }
  // "Incl : Breakfast" is only safe to read when labelled: the fee small print on most
  // vouchers mentions breakfast even for room-only bookings.
  if (/\bbreakfast\b/i.test(labelled)) return 'Bed & Breakfast';
  return labelled;
};

const findRoomCount = (text: string): number => {
  const labelled = text.match(/(?:No\.?\s*of\s*Rooms?|Number\s*of\s*Rooms?|Rooms?)\s*[:\-]?\s*(\d{1,2})\b/i);
  if (labelled) return Number(labelled[1]);
  // "2 Rooms" / "2 x Room"
  const inline = text.match(/\b(\d{1,2})\s*(?:x\s*)?Rooms?\b/i);
  return inline ? Number(inline[1]) : 1;
};

/** Guests are listed under a label; vouchers rarely use the GDS SURNAME/GIVEN form. */
const findGuests = (lines: string[]): ParsedGuest[] => {
  const guests: ParsedGuest[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const match = line.match(
      /(?:Guest|Lead\s*Guest|Passenger|Traveller|Traveler|Occupant)(?:\s*Name)?\s*\d*\s*[:\-]\s*(?:(?:MR|MRS|MS|MISS|DR)\.?\s+)?([A-Za-z][A-Za-z'\- ]{2,40})/i,
    );
    // TripJack prints a bare "Name : Mr VARINDER ARORA" under the room.
    const named = match || line.match(/^Name\s*[:\-]\s*(?:(?:MR|MRS|MS|MISS|DR)\.?\s+)?([A-Za-z][A-Za-z'\- ]{2,40})/i);
    if (!named) continue;
    const fullName = titleCase(named[1].replace(/\s*\((?:adult|child|infant)\).*$/i, '').trim());
    const key = fullName.toLowerCase();
    if (fullName.length < 3 || seen.has(key)) continue;
    seen.add(key);
    guests.push({ fullName });
  }
  return guests;
};

/**
 * City and country are usually the tail of the property address. Take the last two
 * comma-separated parts, which holds for "12 Beach Road, Colombo, Sri Lanka".
 */
const findLocation = (text: string): { city: string; country: string } => {
  const explicitCity = findLabelled(text, /City|Location/, '[A-Za-z][A-Za-z .\'-]{1,40}');
  const explicitCountry = findLabelled(text, /Country/, '[A-Za-z][A-Za-z .\'-]{1,40}');
  if (explicitCity || explicitCountry) {
    return { city: titleCase(explicitCity), country: titleCase(explicitCountry) };
  }

  const address = findLabelled(text, /Address|Hotel\s*Address|Property\s*Address/, '[^\\n]{5,120}');
  if (!address) return { city: '', country: '' };

  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return { city: '', country: '' };
  return {
    city: titleCase(parts[parts.length - 2].replace(/\d{4,}/g, '').trim()),
    country: titleCase(parts[parts.length - 1].replace(/\d{4,}/g, '').trim()),
  };
};

/**
 * Returns a voucher only when the essentials are present: a property name and both dates.
 * Everything else is best-effort and left blank when absent.
 */
export const parseHotelVoucherText = (text: string): ParsedVoucher | null => {
  if (!text || text.length < 120) return null;

  const lines = joinWrappedDates(stripWatermark(text.split('\n').map((line) => line.trim()).filter(Boolean)));
  text = lines.join('\n');

  const unlabelled = findUnlabelledName(lines);
  const name =
    findLabelled(text, /Hotel\s*Name|Property\s*Name|Hotel|Property|Accommodation/, '[^\\n]{2,70}') || unlabelled.name;
  let checkIn = findLabelledDate(text, /Check[\s\-]?in|Arrival\s*Date|Arrival/);
  let checkOut = findLabelledDate(text, /Check[\s\-]?out|Departure\s*Date|Departure/);

  // Some vouchers print an unlabelled "12 Jan 2026 - 15 Jan 2026" range instead.
  if (!checkIn || !checkOut) {
    const allDates = findDates(text);
    if (allDates.length >= 2) {
      checkIn = checkIn || allDates[0];
      checkOut = checkOut || allDates[1];
    }
  }

  if (!name || !checkIn || !checkOut || checkOut <= checkIn) return null;

  // The location printed under an unlabelled name beats a labelled "Address", which on these
  // layouts is the booking agency's own address in the page header.
  const near = name === unlabelled.name ? findLocationNear(lines, unlabelled.index) : { city: '', country: '' };
  const { city, country } = near.city ? near : findLocation(text);

  return {
    passengers: findGuests(lines),
    hotel: {
      name: name.replace(/\s{2,}.*$/, '').trim(),
      city,
      country,
      confirmationNumber: findLabelled(
        text,
        /Confirmation\s*(?:No\.?|Number|Code)|Voucher\s*(?:No\.?|Number)|Booking\s*(?:Ref(?:erence)?|No\.?|Number|ID)|Reservation\s*(?:No\.?|Number)/,
        '[A-Za-z0-9\\-/]{4,25}',
      ).toUpperCase(),
      checkIn,
      checkOut,
      numberOfRooms: findRoomCount(text),
      roomType:
        findLabelled(text, /Room\s*Type|Room\s*Category|Accommodation\s*Type/, '[^\\n]{2,50}') ||
        // TripJack: "Apartment, 1 Bedroom   Incl : Breakfast   Total Guest: 2 Adult"
        (lines.find((line) => /\s{2,}Incl\s*:/i.test(line))?.split(/\s{2,}/)[0] ?? ''),
      mealPlan: findMealPlan(text),
      remarks: findLabelled(text, /Remarks?|Special\s*Requests?|Notes?/, '[^\\n]{2,120}'),
    },
  };
};
