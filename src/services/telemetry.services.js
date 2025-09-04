
// // services/telemetry.services.js
// const fs = require("fs");
// const path = require("path");
// const crypto = require("crypto");

// // ⚠️ Corrige los requires a TUS rutas reales:
// const IngestionJob = require("../models/IngestionJob.models");        // antes: IngestionJob.models
// const AzureDailyUsage = require("../models/AzureDailyUsage.models");  // antes: AzureDailyUsage.models
// const EmailLog = require("../models/EmailLog.models");                // antes: EmailLog.models

// // ---------- Log simple (con fallback de clave) ----------
// function randomLegacyKey() {
//   return `legacy-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
// }

// // ---------- Utils ----------
// function fileSignature(p) {
//   try {
//     const st = fs.statSync(p);
//     return `${path.basename(p)}:${st.size}:${Math.floor(st.mtimeMs)}`;
//   } catch {
//     return path.basename(p || "");
//   }
// }
// function sha40(s) {
//   return crypto.createHash("sha256").update(s).digest("hex").slice(0, 40);
// }
// function makeIdempotencyKey(base) {
//   // Base puede ser string u objeto
//   const raw = typeof base === "string" ? base : JSON.stringify(base || "");
//   return "mail-" + sha40(raw);
// }

// // ---------- Idempotencia de emails ----------
// async function ensureEmailLogPending({ idempotencyKey, to, subject, meta }) {
//   // Crea (o recupera) una fila 'pending' ANTES de enviar. Si ya existe como 'sent/skipped', no reenviar.
//   const [row, created] = await EmailLog.findOrCreate({
//     where: { idempotencyKey },
//     defaults: {
//       to,
//       subject,
//       status: "pending",
//       meta,
//       sentAt: new Date(),
//       attempt: 1,
//     },
//   });

//   if (!created) {
//     if (row.status === "sent" || row.status === "skipped") {
//       return { row, created, shouldSend: false, reason: "duplicate" };
//     }
//     // Reintento sobre misma fila
//     row.attempt = (row.attempt || 1) + 1;
//     row.status = "pending";
//     row.sentAt = new Date();
//     await row.save();
//   }

//   return { row, created, shouldSend: true };
// }

// async function finishEmailLog(row, { status, messageId, errorMessage, providerResponse }) {
//   if (!row) return;
//   row.status = status;
//   if (messageId !== undefined) row.messageId = messageId || null;
//   if (errorMessage !== undefined) row.errorMessage = errorMessage || null;
//   if (providerResponse !== undefined) row.providerResponse = providerResponse || null;
//   row.sentAt = new Date();
//   await row.save();
// }

// // ---------- Log simple (no idempotente) ----------
// async function logEmail({
//   idempotencyKey,        // <-- opcional
//   messageId,
//   to,
//   subject,
//   status,
//   errorMessage,
//   attempt = 1,
//   providerResponse = null,
//   meta = null,
// }) {
//   const key = idempotencyKey || randomLegacyKey(); // <-- Fallback

//   return EmailLog.create({
//     idempotencyKey: key,  // <-- SIEMPRE guardamos una clave
//     messageId,
//     to,
//     subject,
//     status,
//     errorMessage,
//     attempt,
//     providerResponse,     // jsonType: puedes pasar objetos
//     meta,                 // jsonType: puedes pasar objetos
//     sentAt: new Date(),
//   });
// }

// // ---------- Jobs / Azure Usage ----------
// async function createJob({
//   source = "email",
//   sourceId,
//   clienteId,
//   pedidoId,
//   filePath,
//   azureModelId,
//   pagesDetected = null,
// }) {
//   return IngestionJob.create({
//     source,
//     sourceId,
//     clienteId,
//     pedidoId,
//     filePath,
//     status: "processing",
//     azureModelId,
//     pagesDetected,
//     startedAt: new Date(),
//   });
// }

// async function finishJobOk(job, {
//   azureOperationId = null,
//   pagesAzure = null,
//   azureDurationMs = null,
//   status = "processed",
// }) {
//   const finishedAt = new Date();
//   const durationMs = job.startedAt ? (finishedAt - job.startedAt) : null;

//   await job.update({
//     azureOperationId,
//     pagesAzure,
//     azureDurationMs,
//     compareOk: (job.pagesDetected != null && pagesAzure != null)
//       ? (job.pagesDetected === pagesAzure)
//       : null,
//     status,
//     finishedAt,
//     durationMs,
//   });

//   await bumpAzureDailyUsage({
//     date: finishedAt,
//     azureModelId: job.azureModelId,
//     pages: pagesAzure || 0,
//     docs: 1,
//   });

//   return job;
// }

// async function finishJobError(job, { errorDetails }) {
//   const finishedAt = new Date();
//   const durationMs = job.startedAt ? (finishedAt - job.startedAt) : null;
//   await job.update({ status: "error", errorDetails, finishedAt, durationMs });
//   return job;
// }

// async function bumpAzureDailyUsage({ date, azureModelId, pages = 0, docs = 0, region = null }) {
//   const ymd = new Date(date).toISOString().slice(0, 10);
//   const [row] = await AzureDailyUsage.findOrCreate({
//     where: { date: ymd, azureModelId, region },
//     defaults: { documentsProcessed: 0, pagesProcessed: 0 },
//   });
//   await row.update({
//     documentsProcessed: row.documentsProcessed + docs,
//     pagesProcessed: row.pagesProcessed + pages,
//   });
// }

// module.exports = {
//   // idempotencia (para usar desde email-logged.services.js)
//   fileSignature,
//   makeIdempotencyKey,
//   ensureEmailLogPending,
//   finishEmailLog,

//   // log simple (opcional)
//   logEmail,

//   // jobs
//   createJob,
//   finishJobOk,
//   finishJobError,
//   bumpAzureDailyUsage,
// };

// services/telemetry.services.js
// services/telemetry.services.js
const { Op } = require("sequelize");
const {
  IngestionJob,
  IngestionAttempt,
  AzureDailyUsage,
} = require("../models");

/** Crea un job y lo marca como "processing" con started_at */
async function createJob({
  source = "email",
  sourceId = null,
  clienteId = null,
  pedidoId = null,
  filePath = null,
  azureModelId = null,
  pagesDetected = null,
  emailInboundId = null,        // opcional si quieres enlazar con email_inbound
  pdfName = null,               // opcional
  fileHashSha256 = null,        // opcional
  fileSizeBytes = null,         // opcional
}) {
  const startedAt = new Date();
  const job = await IngestionJob.create({
    source,
    sourceId,
    clienteId,
    pedidoId,
    filePath,
    azureModelId,
    pagesDetected,
    status: "processing",
    startedAt,
    emailInboundId,
    pdfName,
    fileHashSha256,
    fileSizeBytes,
  });
  return job;
}

/** Upsert de uso diario por modelo / región */
async function bumpAzureDailyUsage({
  azureModelId = null,
  pages = 0,
  region = process.env.AZURE_REGION || null,
  date = null, // si no lo pasas, se usa hoy
}) {
  const d = date ? new Date(date) : new Date();
  d.setHours(0, 0, 0, 0); // DATEONLY-friendly

  const [row, created] = await AzureDailyUsage.findOrCreate({
    where: {
      date: d,                 // Sequelize DATEONLY acepta Date o 'YYYY-MM-DD'
      azureModelId: azureModelId || null,
      region: region || null,
    },
    defaults: {
      documentsProcessed: 1,
      pagesProcessed: Number(pages) || 0,
    },
  });

  if (!created) {
    row.documentsProcessed = (row.documentsProcessed || 0) + 1;
    row.pagesProcessed = (row.pagesProcessed || 0) + (Number(pages) || 0);
    await row.save();
  }
}

/** Finaliza en OK un job, mide tiempos y registra intento + uso diario */
async function finishJobOk(job, {
  azureOperationId = null,
  pagesAzure = null,
  azureDurationMs = null,
  status = "processed", // puedes pasar "partial"
}) {
  const finishedAt = new Date();
  const durationMs = job.startedAt ? (finishedAt - job.startedAt) : null;

  await IngestionJob.update({
    status,
    azureOperationId,
    pagesAzure,
    azureDurationMs,
    finishedAt,
    durationMs,
    compareOk: (pagesAzure != null && job.pagesDetected != null)
      ? pagesAzure === job.pagesDetected
      : null,
  }, { where: { id: job.id } });

  // registra intento success
  await IngestionAttempt.create({
    jobId: job.id,
    status: "success",
    errorMessage: null,
  });

  // suma a uso diario de Azure
  if (pagesAzure != null) {
    await bumpAzureDailyUsage({
      azureModelId: job.azureModelId || null,
      pages: pagesAzure,
    });
  }
}

/** Finaliza en ERROR un job y registra intento */
async function finishJobError(job, { errorDetails }) {
  const finishedAt = new Date();
  const durationMs = job.startedAt ? (finishedAt - job.startedAt) : null;

  await IngestionJob.update({
    status: "error",
    errorDetails: String(errorDetails || "").slice(0, 4000),
    finishedAt,
    durationMs,
  }, { where: { id: job.id } });

  await IngestionAttempt.create({
    jobId: job.id,
    status: "error",
    errorMessage: String(errorDetails || "").slice(0, 4000),
  });
}

module.exports = {
  createJob,
  finishJobOk,
  finishJobError,
  bumpAzureDailyUsage,
};
