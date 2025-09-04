// services/ingestion-jobs.service.js
const { IngestionJob } = require("../../models");

async function createEmailJobsForAttachments({ messageId, clienteId = null, azureModelId, attachments }) {
  // attachments: [{ nombre, bufferPath? }]
  const startedAt = new Date();  
  const created = [];
  for (const att of attachments) {
    const job = await IngestionJob.create({
      source: "email",
      sourceId: messageId,
      clienteId,
      pedidoId: null,
      filePath: att.bufferPath || att.nombre, // guardas ruta local/audit si quieres
      status: "queued",
      azureModelId,
      startedAt,
      finishedAt: null,
      durationMs: null,
      azureDurationMs: null,
    });
    created.push(job);
  }
  return created;
}

module.exports = { createEmailJobsForAttachments };
