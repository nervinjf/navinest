// services/email-logged.service.js
const path = require("path");
const {
  ensureEmailLogPending,
  finishEmailLog,
  logEmail,
  makeIdempotencyKey,
} = require("../services/Report/email-log.services");

const {
  enviarCorreoConAdjunto,
  enviarCorreoDeError,
} = require("../utils/procesar archivos/enviarCorreo");
const addressParser = require('nodemailer/lib/addressparser');


function parseFirstEmail(input) {
  if (!input) return null;
  try {
    const parsed = addressParser(String(input));
    const first = parsed?.[0];
    const email = first?.address?.trim();
    return email || null;
  } catch { return null; }
}
function ensureEmailLocal(v) {
  if (typeof v === 'string' && v.includes('@')) return v.trim();
  return process.env.DEFAULT_REPORT_EMAIL || 'nflores@neb.com.ve';
}

// Claves determinísticas
function keyExcel({ rutaExcel, to, sourceId, meta }) {
  // Si tenemos un ID estable del correo, úsalo
  if (sourceId) return makeIdempotencyKey({ kind: "excel_global", to, sourceId });
  // Fallback: firma del archivo (menos robusto)
  const sig = fileSignature(rutaExcel);
  return makeIdempotencyKey({ kind: "excel_global", to, sig, meta });
}


function keyFaltantes({ faltantes, to, sourceId, meta }) {
  if (sourceId) return makeIdempotencyKey({ kind: "faltantes", to, sourceId });
  // Fallback: contenido de faltantes
  return makeIdempotencyKey({ kind: "faltantes", to, items: faltantes, meta });
}

async function enviarCorreoConAdjuntoLogged(rutaExcel, adjuntos = [], ctx = {}) {
  const to = parseFirstEmail(ctx?.destinatario) || ensureEmailLocal(ctx?.destinatario);
  const subject = ctx?.subject || "Excel Global";
  const meta = { tipo: "excel_global", ...ctx, archivo: path.basename(rutaExcel) };

  const idempotencyKey =
    ctx.idempotencyKey // ← si viene desde procesarArchivo (excel:${sourceId}), úsala tal cual
    || keyExcel({ rutaExcel, to, sourceId: ctx.sourceId || ctx.correoId, meta });

  const { row, shouldSend } = await ensureEmailLogPending({ idempotencyKey, to, subject, meta });
  if (!shouldSend) {
    await finishEmailLog(row, { status: "skipped" });
    return { skipped: true, reason: "duplicate" };
  }

  try {
    const ctx2 = { ...ctx, destinatario: to };
    const resp = await enviarCorreoConAdjunto(rutaExcel, adjuntos, ctx2);
    await finishEmailLog(row, {
      status: "sent",
      messageId: resp?.messageId || null,
      providerResponse: resp,
    });
    return resp;
  } catch (err) {
    await finishEmailLog(row, {
      status: "failed",
      errorMessage: err?.message,
      providerResponse: { message: err?.message, stack: err?.stack },
    });
    throw err;
  }
}

async function enviarCorreoDeErrorLogged(_unused, faltantes = [], ctx = {}) {
  const to = parseFirstEmail(ctx?.destinatario) || ensureEmailLocal(ctx?.destinatario);
  const subject = ctx?.subject || "Productos no encontrados";
  const meta = { tipo: "faltantes", ...ctx, totalFaltantes: Array.isArray(faltantes) ? faltantes.length : 0 };

  const idempotencyKey =
    ctx.idempotencyKey // ← p.ej. faltantes:${sourceId}
    || keyFaltantes({ faltantes, to, sourceId: ctx.sourceId || ctx.correoId, meta });

  const { row, shouldSend } = await ensureEmailLogPending({ idempotencyKey, to, subject, meta });
  if (!shouldSend) {
    await finishEmailLog(row, { status: "skipped" });
    return { skipped: true, reason: "duplicate" };
  }

  try {
    const ctx2 = { ...ctx, destinatario: to };
    const resp = await enviarCorreoDeError(null, faltantes, ctx2);
    await finishEmailLog(row, {
      status: "sent",
      messageId: resp?.messageId || null,
      providerResponse: resp,
    });
    return resp;
  } catch (err) {
    await finishEmailLog(row, {
      status: "failed",
      errorMessage: err?.message,
      providerResponse: { message: err?.message, stack: err?.stack },
    });
    throw err;
  }
}

module.exports = { enviarCorreoConAdjuntoLogged, enviarCorreoDeErrorLogged };
