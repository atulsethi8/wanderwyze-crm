import { extractPdfText } from './pdfTextService';

/**
 * Document extraction, entirely in the browser.
 *
 * pdf.js reads the PDF's text layer and a deterministic parser turns it into form data.
 * There is no network call and no API cost. A document the parser cannot read completely
 * yields null, and the caller keeps the attached PDF and asks for manual entry.
 */
export interface ExtractionOutcome<T> {
  data: T | null;
  /** Why extraction produced nothing, for a message the agent can act on. */
  reason?: 'no-text-layer' | 'unrecognised-layout' | 'unreadable-pdf';
}

interface ExtractionRequest<T> {
  /** Base64 file content, without the data-URL prefix. */
  base64: string;
  mimeType: string;
  parse: (text: string) => T | null;
}

const isPdf = (mimeType: string) => !mimeType || mimeType.toLowerCase().includes('pdf');

export const extractDocumentData = async <T>({
  base64,
  mimeType,
  parse,
}: ExtractionRequest<T>): Promise<ExtractionOutcome<T>> => {
  if (!isPdf(mimeType)) return { data: null, reason: 'no-text-layer' };

  let text: string;
  let hasTextLayer: boolean;
  let pageCount: number;

  try {
    ({ text, hasTextLayer, pageCount } = await extractPdfText(base64));
  } catch (error) {
    console.warn('[extract] could not read the PDF', error);
    return { data: null, reason: 'unreadable-pdf' };
  }

  // Parked on window so a document that fails to parse can be inspected and shared.
  (window as any).__lastDocumentText = text;
  console.log(
    `[extract] pages=${pageCount} textLayer=${hasTextLayer} chars=${text.length}` +
      ' - inspect the raw text with: copy(window.__lastDocumentText)',
  );

  if (!hasTextLayer) return { data: null, reason: 'no-text-layer' };

  const data = parse(text);
  if (!data) {
    console.log('[extract] the layout did not match any known pattern');
    return { data: null, reason: 'unrecognised-layout' };
  }
  return { data };
};

/** Message for the agent explaining why a document could not be filled in automatically. */
export const explainExtractionFailure = (reason: ExtractionOutcome<unknown>['reason']): string => {
  switch (reason) {
    case 'no-text-layer':
      return 'This looks like a scanned document, so there is no text to read. The file is attached - please enter the details manually.';
    case 'unreadable-pdf':
      return 'This PDF could not be opened (it may be password protected or corrupt). The file is attached - please enter the details manually.';
    default:
      return 'This document\'s layout was not recognised. The file is attached - please enter the details manually.';
  }
};
