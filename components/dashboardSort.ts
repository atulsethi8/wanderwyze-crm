import type { Agent, Docket } from '../types';

/**
 * Ordering for the dashboard's booking queue.
 *
 * Kept apart from the Dashboard component so it carries no runtime imports and can be
 * checked directly - importing the component would pull in the Supabase client.
 */

export type SortKey =
  | 'docketNo'
  | 'bookingRef'
  | 'leadTraveller'
  | 'travelDate'
  | 'bookingDate'
  | 'product'
  | 'status'
  | 'amount'
  | 'balance'
  | 'agent';

export type SortDirection = 'asc' | 'desc';

export interface ProductSummary {
  type: 'Flights' | 'Hotels' | 'Packages';
  text: string;
}

export interface Row {
  docket: Docket;
  product: ProductSummary;
  amount: number;
  balance: number;
  bookingRef: string;
  leadTraveller: string;
  travelDate: string;
  agent?: Agent;
}

/**
 * Table columns. Declaring them here keeps the header row and the sort logic in step - a
 * column is sortable precisely when it names a key, and nothing else needs updating.
 */
export const COLUMNS: {
  label: string;
  sortKey?: SortKey;
  /** Dates and money read most usefully largest-first, so they open descending. */
  defaultDirection?: SortDirection;
}[] = [
  { label: 'Docket No.', sortKey: 'docketNo', defaultDirection: 'desc' },
  { label: 'PNR / Booking Ref', sortKey: 'bookingRef' },
  { label: 'Lead Traveller', sortKey: 'leadTraveller' },
  { label: 'Travel Date', sortKey: 'travelDate', defaultDirection: 'desc' },
  { label: 'Booking Date', sortKey: 'bookingDate', defaultDirection: 'desc' },
  { label: 'Product / Trip Details', sortKey: 'product' },
  { label: 'Status', sortKey: 'status' },
  { label: 'Amount', sortKey: 'amount', defaultDirection: 'desc' },
  { label: 'Balance', sortKey: 'balance', defaultDirection: 'desc' },
  { label: 'Agent', sortKey: 'agent' },
  { label: 'Actions' },
];

/** Newest booking first. Ordering by updatedAt instead would let merely opening and saving
 *  an old docket jump it to the top of the queue. */
export const DEFAULT_SORT: { key: SortKey; direction: SortDirection } = {
  key: 'bookingDate',
  direction: 'desc',
};

const sortValue = (row: Row, key: SortKey): string | number => {
  switch (key) {
    case 'docketNo':
      return row.docket.docketNo || row.docket.id || '';
    case 'bookingRef':
      return row.bookingRef;
    case 'leadTraveller':
      return row.leadTraveller || '';
    case 'travelDate':
      return row.travelDate;
    case 'bookingDate':
      return row.docket.createdAt || '';
    case 'product':
      return row.product.text;
    case 'status':
      return row.docket.status;
    case 'amount':
      return row.amount;
    case 'balance':
      return row.balance;
    case 'agent':
      return row.agent?.name || '';
  }
};

/** An em dash is how a missing booking reference is rendered, so treat it as absent too. */
const isBlank = (value: string | number) => value === '' || value === '—';

export const compareRows = (a: Row, b: Row, key: SortKey, direction: SortDirection) => {
  const left = sortValue(a, key);
  const right = sortValue(b, key);

  // Rows missing this value sink to the bottom in both directions - a docket with no travel
  // date should never lead the table just because the sort was flipped to ascending.
  const leftBlank = isBlank(left);
  const rightBlank = isBlank(right);
  if (leftBlank !== rightBlank) return leftBlank ? 1 : -1;
  if (leftBlank && rightBlank) return 0;

  const result =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right), undefined, {
          numeric: true,
          sensitivity: 'base',
        });

  return direction === 'asc' ? result : -result;
};

/** The direction a column should adopt when it first becomes the sort column. */
export const nextSort = (
  current: { key: SortKey; direction: SortDirection },
  key: SortKey,
): { key: SortKey; direction: SortDirection } =>
  current.key === key
    ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    : {
        key,
        direction: COLUMNS.find((column) => column.sortKey === key)?.defaultDirection ?? 'asc',
      };
