import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { pageToLines } from './pdfLines';

/**
 * pdf.js is well over a megabyte, so it is code-split and pulled in on the first PDF upload
 * rather than on every page load. The promise is cached so later uploads reuse the module.
 */
let pdfjsModule: Promise<typeof import('pdfjs-dist')> | null = null;

const loadPdfjs = () => {
  if (!pdfjsModule) {
    pdfjsModule = import('pdfjs-dist').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      return lib;
    });
  }
  return pdfjsModule;
};

/** Below this many characters the PDF is almost certainly a scan with no usable text layer. */
const MIN_USEFUL_TEXT_LENGTH = 120;

export interface PdfTextResult {
  text: string;
  pageCount: number;
  /** False for scans and image-only PDFs, which cannot be read at all. */
  hasTextLayer: boolean;
}

const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/**
 * Pulls the text layer out of a base64 PDF entirely in the browser. Returns
 * `hasTextLayer: false` for scans, which cannot be parsed.
 */
export const extractPdfText = async (base64: string): Promise<PdfTextResult> => {
  const pdfjsLib = await loadPdfjs();
  const loadingTask = pdfjsLib.getDocument({ data: base64ToBytes(base64) });
  const doc = await loadingTask.promise;

  try {
    const pages: string[] = [];
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      const textItems = content.items.filter((item): item is TextItem => 'str' in item);
      pages.push(pageToLines(textItems).join('\n'));
      page.cleanup();
    }

    const text = pages.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
    return { text, pageCount: doc.numPages, hasTextLayer: text.length >= MIN_USEFUL_TEXT_LENGTH };
  } finally {
    // Tears down the worker so repeated uploads do not leak one worker per file.
    await loadingTask.destroy();
  }
};
