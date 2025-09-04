// src/services/email-logged.services.js
const crypto = require("crypto");
const { EmailLog } = require("../../models");

// ---------------- helpers ----------------
function toJSONText(v) {
  try { return v == null ? null : JSON.stringify(v); } catch { return null; }
}
function sha40(s) {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 40);
}
function makeIdempotencyKey(base) {
  const raw = typeof base === "string" ? base : JSON.stringify(base || "");
  return "mail-" + sha40(raw);
}
function randomLegacyKey() {
  return `legacy-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

// ------------- API pública ---------------
async function ensureEmailLogPending({ idempotencyKey, to, subject, meta }) {
  const [row, created] = await EmailLog.findOrCreate({
    where: { idempotencyKey },
    defaults: {
      to,
      subject,
      status: "pending",
      meta: toJSONText(meta),   // guardamos como texto JSON
      sentAt: new Date(),
      attempt: 1,
    },
  });

  if (!created) {
    // si ya se mandó o se saltó, no volver a enviar
    if (row.status === "sent" || row.status === "skipped") {
      return { row, created, shouldSend: false, reason: "duplicate" };
    }
    row.attempt = (row.attempt || 1) + 1;
    row.status = "pending";
    row.sentAt = new Date();
    await row.save();
  }

  return { row, created, shouldSend: true };
}

async function finishEmailLog(row, { status, messageId, errorMessage, providerResponse }) {
  if (!row) return;
  row.status = status;
  if (messageId !== undefined) row.messageId = messageId || null;
  if (errorMessage !== undefined) row.errorMessage = errorMessage || null;
  if (providerResponse !== undefined) row.providerResponse = toJSONText(providerResponse);
  row.sentAt = new Date();
  await row.save();
}

async function logEmail({
  idempotencyKey,
  messageId,
  to,
  subject,
  status,
  errorMessage,
  attempt = 1,
  providerResponse = null,
  meta = null,
}) {
  const key = idempotencyKey || randomLegacyKey();

  return EmailLog.create({
    idempotencyKey: key,
    messageId,
    to,
    subject,
    status,
    errorMessage,
    attempt,
    providerResponse: toJSONText(providerResponse),
    meta: toJSONText(meta),
    sentAt: new Date(),
  });
}

module.exports = {
  makeIdempotencyKey,
  ensureEmailLogPending,
  finishEmailLog,
  logEmail,
};
