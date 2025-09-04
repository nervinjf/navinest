// utils/pdf.js
const { PDFDocument } = require("pdf-lib");

/** Divide un PDF (Buffer) en Buffers por página */
async function splitPDFIntoPages(pdfBuffer) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = pdfDoc.getPageCount();
  const pagesBuffers = [];

  for (let i = 0; i < totalPages; i++) {
    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
    newPdf.addPage(copiedPage);
    const pdfBytes = await newPdf.save();
    pagesBuffers.push(Buffer.from(pdfBytes));
  }
  return { pagesBuffers, totalPages };
}

/** Combina N buffers PDF en un solo Buffer PDF */
async function mergePDFBuffers(buffers) {
  const mergedPdf = await PDFDocument.create();
  for (const buf of buffers) {
    if (!buf) continue;
    const pdf = await PDFDocument.load(buf);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((p) => mergedPdf.addPage(p));
  }
  const mergedBytes = await mergedPdf.save();
  return Buffer.from(mergedBytes);
}

module.exports = { splitPDFIntoPages, mergePDFBuffers };