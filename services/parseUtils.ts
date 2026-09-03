/**
 * Text-normalisation helpers shared by the e-ticket and hotel-voucher parsers.
 * Travel documents print dates and times in a handful of recurring shapes; these
 * readers reduce all of them to the YYYY-MM-DD and HH:MM the docket form expects.
 */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

export const titleCase = (value: string): string =>
  value.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\s+/g, ' ').trim();

const toIso = (year: number, month: number, day: number): string => {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return '';
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00`);
  return isNaN(parsed.getTime()) ? '' : iso;
};

/** Documents are sometimes printed without a year (GDS short form); assume the current one. */
const resolveYear = (raw?: string): number => {
  if (!raw) return new Date().getFullYear();
  const year = Number(raw);
  return raw.length <= 2 ? 2000 + year : year;
};

const monthFromName = (name: string): number | undefined =>
  MONTHS[name.slice(0, 4).toLowerCase()] ?? MONTHS[name.slice(0, 3).toLowerCase()];

/**
 * Normalises a single date token to YYYY-MM-DD. Numeric dates are read day-first, the
 * convention across Indian and European issuers and all GDS output.
 */
export const normaliseDate = (raw: string): string => {
  const value = raw.trim();
  let match: RegExpMatchArray | null;

  // 2026-01-12
  if ((match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    return toIso(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  // 12 Jan 2026 / 12-JAN-2026 / 12JAN26 / 12 January 2026
  if ((match = value.match(/^(\d{1,2})[\s\-/]*([A-Za-z]{3,9})[\s\-/,]*(\d{2,4})?$/))) {
    const month = monthFromName(match[2]);
    return month ? toIso(resolveYear(match[3]), month, Number(match[1])) : '';
  }
  // Jan 12, 2026 / January 12 2026
  if ((match = value.match(/^([A-Za-z]{3,9})[\s\-]*(\d{1,2}),?[\s\-]*(\d{2,4})?$/))) {
    const month = monthFromName(match[1]);
    return month ? toIso(resolveYear(match[3]), month, Number(match[2])) : '';
  }
  // 12/01/2026 - day first
  if ((match = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/))) {
    return toIso(resolveYear(match[3]), Number(match[2]), Number(match[1]));
  }
  return '';
};

const MONTH_NAMES = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';

const DATE_PATTERN = new RegExp(
  [
    String.raw`\d{4}-\d{1,2}-\d{1,2}`,
    String.raw`\d{1,2}\s*[-/]?\s*(?:${MONTH_NAMES})[a-z]*\s*[-/,]?\s*\d{2,4}`,
    String.raw`(?:${MONTH_NAMES})[a-z]*\s+\d{1,2},?\s+\d{4}`,
    String.raw`\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}`,
  ].join('|'),
  'gi',
);

/** Every date in the text, in document order, de-duplicated. */
export const findDates = (text: string): string[] => {
  const found = (text.match(DATE_PATTERN) || []).map(normaliseDate).filter(Boolean);
  return [...new Set(found)];
};

/** The first date appearing after `label`, for "Check-in: 12 Jan 2026" style fields. */
export const findLabelledDate = (text: string, label: RegExp): string => {
  // The label is grouped: a bare alternation would bind looser than the trailing pattern.
  const match = text.match(new RegExp(`(?:${label.source})[^\\n]{0,60}`, 'i'));
  if (!match) return '';
  const dates = findDates(match[0]);
  return dates[0] || '';
};

/** Normalises 14:30 / 2:30 PM / 1430 hrs to 24-hour HH:MM. */
export const findTimes = (text: string): string[] => {
  const times: string[] = [];
  const pattern = /\b(\d{1,2})[:.](\d{2})\s*(AM|PM)?\b|\b(\d{4})\s*(?:hrs|hours)\b/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    let hours: number;
    let minutes: number;

    if (match[4]) {
      hours = Number(match[4].slice(0, 2));
      minutes = Number(match[4].slice(2));
    } else {
      hours = Number(match[1]);
      minutes = Number(match[2]);
      const meridiem = match[3]?.toUpperCase();
      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
    }

    if (hours > 23 || minutes > 59) continue;
    times.push(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
  }
  return times;
};

/**
 * Reads the value printed after a label, on the same line.
 *
 * A separator is required — either punctuation ("Hotel Name: The Grand Palace") or the
 * column gap that pageToLines emits for tabular layouts ("Hotel Name   The Grand Palace").
 * Without that, a heading like "HOTEL BOOKING VOUCHER" would match the label `Hotel` and
 * return "BOOKING VOUCHER" as the property name.
 */
export const findLabelled = (text: string, label: RegExp, valuePattern = '[^\\n]{1,80}'): string => {
  // The label must be grouped: a bare alternation binds looser than the value capture,
  // so an early branch would match and leave group 1 undefined.
  const match = text.match(
    new RegExp(`(?:${label.source})(?:\\s*[:\\-]\\s*|\\s{2,})(${valuePattern})`, 'i'),
  );
  return match?.[1] ? match[1].trim().replace(/\s{2,}.*$/, '').trim() : '';
};
