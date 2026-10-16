// Extração de texto de currículo (R13) — NLP determinístico, sem LLM (D11).
// Nunca lança: entrada ilegível (PDF escaneado, arquivo corrompido) retorna null, e
// o cálculo de compatibilidade (score.ts) segue com o sinal que sobrar.

import { PDFParse } from "pdf-parse";
import { extractRawText } from "mammoth";

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function extractText(buffer: Buffer, mimeType: string): Promise<string | null> {
  try {
    if (mimeType === PDF_MIME) return await extractFromPdf(buffer);
    if (mimeType === DOCX_MIME) return await extractFromDocx(buffer);
    return null;
  } catch {
    return null;
  }
}

async function extractFromPdf(buffer: Buffer): Promise<string | null> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = result.text?.trim();
    return text ? text : null;
  } finally {
    await parser.destroy();
  }
}

async function extractFromDocx(buffer: Buffer): Promise<string | null> {
  const result = await extractRawText({ buffer });
  const text = result.value?.trim();
  return text ? text : null;
}
