// services/email-inbound.service.js
const { EmailInbound } = require("../../models");
const { Op } = require("sequelize");

async function recordInbound({ messageId, fromAddr, toAddr, subject, receivedAt }) {
  if (!messageId) throw new Error("messageId requerido para EmailInbound");

  const [row] = await EmailInbound.findOrCreate({
    where: { messageId },
    defaults: { fromAddr, toAddr, subject, receivedAt, whitelistOk: null },
  });

  // si ya existía, actualiza datos faltantes
  if (row) {
    let changed = false;
    if (fromAddr && !row.fromAddr) { row.fromAddr = fromAddr; changed = true; }
    if (toAddr   && !row.toAddr)   { row.toAddr   = toAddr;   changed = true; }
    if (subject  && !row.subject)  { row.subject  = subject;  changed = true; }
    if (receivedAt && !row.receivedAt) { row.receivedAt = receivedAt; changed = true; }
    if (changed) await row.save();
  }
  return row;
}

async function markWhitelist(messageId, ok, reason = null) {
  const row = await EmailInbound.findOne({ where: { messageId } });
  if (!row) return null;
  row.whitelistOk = !!ok;
  // Si quieres guardar la razón y contadores, agrega un campo JSON "meta" en el modelo (opcional)
  if (row.meta) {
    row.meta.whitelist_reason = reason;
  }
  await row.save();
  return row;
}

async function updateAttachmentStats(messageId, { total = 0, pdfs = 0 } = {}) {
  const row = await EmailInbound.findOne({ where: { messageId } });
  if (!row) return null;
  // Si añadiste campos: attachments_total / attachments_pdfs (opcional)
  if ("attachments_total" in row && "attachments_pdfs" in row) {
    row.attachments_total = total;
    row.attachments_pdfs  = pdfs;
  } else if (row.meta) {
    row.meta = { ...(row.meta || {}), attachments_total: total, attachments_pdfs: pdfs };
  }
  await row.save();
  return row;
}

module.exports = { recordInbound, markWhitelist, updateAttachmentStats };
