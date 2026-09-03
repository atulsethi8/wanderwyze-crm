/**
 * Rebuilds visual lines from a PDF page's positioned text runs.
 *
 * Travel documents are tabular, and a PDF's text runs arrive in content-stream order, not
 * reading order — a table cell from the far right of a row can appear long before the cell
 * to its left. Concatenating runs naively therefore scrambles rows together and destroys the
 * association between a flight, its airports and its times. Grouping by baseline restores it.
 *
 * Kept free of any pdf.js import so it can run in Node for the parser check harness.
 */

/** The subset of pdf.js's TextItem this needs. */
export interface PositionedTextItem {
  str: string;
  /** pdf.js transform matrix; [4] is x, [5] is y. */
  transform: number[];
  width?: number;
}

/** Vertical distance (in PDF points) within which two runs belong to the same visual line. */
const LINE_TOLERANCE = 3;
/** Horizontal gap that reads as a column break rather than a word space. */
const COLUMN_GAP = 8;

export const pageToLines = (items: PositionedTextItem[]): string[] => {
  const rows: { y: number; items: PositionedTextItem[] }[] = [];

  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    const y = item.transform[5];
    // Snap onto an existing row so slightly wobbling baselines stay on one line.
    const row = rows.find((r) => Math.abs(r.y - y) <= LINE_TOLERANCE);
    if (row) row.items.push(item);
    else rows.push({ y, items: [item] });
  }

  return rows
    // PDF origin is bottom-left, so the highest y is the topmost line.
    .sort((a, b) => b.y - a.y)
    .map(({ items: rowItems }) => {
      rowItems.sort((a, b) => a.transform[4] - b.transform[4]);
      let line = '';
      let cursor = -Infinity;
      for (const item of rowItems) {
        const x = item.transform[4];
        if (line) line += x - cursor > COLUMN_GAP ? '  ' : line.endsWith(' ') ? '' : ' ';
        line += item.str.trim();
        cursor = x + (item.width || 0);
      }
      return line.trim();
    })
    .filter(Boolean);
};
