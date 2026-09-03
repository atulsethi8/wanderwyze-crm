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

/** Meal plans appear either spelled out or as trade codes. */
const MEAL_PLANS: [RegExp, string][] = [
  [/\ball\s*inclusive\b|\bAI\b/i, 'All Inclusive'],
  [/\bfull\s*board\b|\bFB\b/i, 'Full Board'],
  [/\bhalf\s*board\b|\bHB\b/i, 'Half Board'],
  [/\bbed\s*(?:and|&)\s*breakfast\b|\bbreakfast\s*included\b|\bBB\b/i, 'Bed & Breakfast'],
  [/\broom\s*only\b|\bno\s*meals\b|\bRO\b/i, 'Room Only'],
];

const findMealPlan = (text: string): string => {
  const labelled = findLabelled(text, /Meal\s*Plan|Board\s*Basis|Inclusions?/);
  const haystack = labelled || text;
  for (const [pattern, label] of MEAL_PLANS) {
    if (pattern.test(haystack)) return label;
  }
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
    if (!match) continue;
    const fullName = titleCase(match[1].replace(/\s*\((?:adult|child|infant)\).*$/i, '').trim());
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

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  const name = findLabelled(text, /Hotel\s*Name|Property\s*Name|Hotel|Property|Accommodation/, '[^\\n]{2,70}');
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

  const { city, country } = findLocation(text);

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
      roomType: findLabelled(text, /Room\s*Type|Room\s*Category|Accommodation\s*Type/, '[^\\n]{2,50}'),
      mealPlan: findMealPlan(text),
      remarks: findLabelled(text, /Remarks?|Special\s*Requests?|Notes?/, '[^\\n]{2,120}'),
    },
  };
};
