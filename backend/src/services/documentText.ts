import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import pdfParse from 'pdf-parse';
import Tesseract from 'tesseract.js';
import { promisify } from 'util';
import { query } from '../db';

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const execFileAsync = promisify(execFile);
const OCR_MIN_TEXT_LENGTH = parseInt(process.env.OCR_MIN_TEXT_LENGTH || '40', 10);
const OCR_MAX_PDF_PAGES = parseInt(process.env.OCR_MAX_PDF_PAGES || '20', 10);

const normalizeExtractedText = (text: string) => text.replace(/\s+/g, ' ').trim();

const extractTextFromImage = async (filePath: string): Promise<string> => {
  const result = await Tesseract.recognize(filePath, 'fra+eng');
  return normalizeExtractedText(result.data.text || '');
};

const extractTextFromScannedPdfPages = async (pdfFilePath: string): Promise<string> => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ged-ocr-'));
  const outputPrefix = path.join(tempDir, 'page');

  try {
    await execFileAsync('pdftoppm', ['-png', pdfFilePath, outputPrefix]);

    const files = await fs.readdir(tempDir);
    const pageImages = files
      .filter((fileName) => fileName.startsWith('page-') && fileName.endsWith('.png'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (pageImages.length === 0) {
      return '';
    }

    const selectedPages = pageImages.slice(0, OCR_MAX_PDF_PAGES);
    const extractedChunks: string[] = [];

    for (const pageImage of selectedPages) {
      const pagePath = path.join(tempDir, pageImage);
      const text = await extractTextFromImage(pagePath);
      if (text) extractedChunks.push(text);
    }

    return normalizeExtractedText(extractedChunks.join(' '));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur OCR PDF scanné';
    if (message.includes('ENOENT')) {
      throw new Error('pdftoppm est requis pour OCR des PDF scannés (installer poppler-utils).');
    }
    throw error;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

const extractTextFromPdf = async (filePath: string): Promise<string> => {
  const fileBuffer = await fs.readFile(filePath);
  const data = await pdfParse(fileBuffer);
  const parsedText = normalizeExtractedText(data.text || '');

  // PDF scanné: souvent pas de couche texte, on bascule vers OCR page par page.
  if (parsedText.length >= OCR_MIN_TEXT_LENGTH) {
    return parsedText;
  }

  const scannedText = await extractTextFromScannedPdfPages(filePath);
  return scannedText || parsedText;
};

export const extractAndPersistPieceJointeText = async (
  pieceJointeId: number,
  filePath: string,
  mimeType: string
) => {
  await query('UPDATE pieces_jointes SET ocr_status = $1 WHERE id = $2', ['PROCESSING', pieceJointeId]);

  try {
    let extractedText = '';

    if (mimeType === 'application/pdf') {
      extractedText = await extractTextFromPdf(filePath);
    } else if (IMAGE_MIME_TYPES.has(mimeType)) {
      extractedText = await extractTextFromImage(filePath);
    } else {
      await query('UPDATE pieces_jointes SET ocr_status = $1 WHERE id = $2', ['UNSUPPORTED', pieceJointeId]);
      return;
    }

    const nextStatus = extractedText ? 'DONE' : 'EMPTY';
    await query(
      `UPDATE pieces_jointes
       SET extracted_text = $1,
           extracted_at = CURRENT_TIMESTAMP,
           ocr_status = $2,
           ocr_error = NULL
       WHERE id = $3`,
      [extractedText || null, nextStatus, pieceJointeId]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur OCR inconnue';
    await query(
      `UPDATE pieces_jointes
       SET ocr_status = $1,
           ocr_error = $2
       WHERE id = $3`,
      ['FAILED', message.slice(0, 1000), pieceJointeId]
    );
    throw new Error(message);
  }
};
