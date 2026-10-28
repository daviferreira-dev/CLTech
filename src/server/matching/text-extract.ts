// Extração de texto de currículo (R13) — NLP determinístico, sem LLM (D11).
// Nunca lança: entrada ilegível (PDF escaneado, arquivo corrompido) retorna null, e
// o cálculo de compatibilidade (score.ts) segue com o sinal que sobrar.

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

// O pdfjs-dist roda `new DOMMatrix()` ao ser importado e só acha o @napi-rs/canvas por um
// require dinâmico, que o rastreio de arquivos da Vercel não segue: sem o canvas, o import
// estourava e derrubava a rota de upload inteira (500). O `pdf-parse/worker` importa o canvas
// estaticamente e preenche DOMMatrix/Path2D/ImageData no global, por isso vem primeiro; e o
// carregamento sob demanda faz uma falha aqui virar só PDF ilegível (null), não upload perdido.
async function extractFromPdf(buffer: Buffer): Promise<string | null> {
  const { CanvasFactory } = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer, CanvasFactory });
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
