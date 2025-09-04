// services/Report/pedido-job-link.services.js
const { PedidoIngestionJob } = require("../../models");

async function linkJobToPedidos(jobId, pedidoIds = []) {
  const uniq = [...new Set((pedidoIds || []).map(Number).filter(Boolean))];
  if (!jobId || uniq.length === 0) return 0;

  const rows = uniq.map(pedidoId => ({ jobId, pedidoId }));
  // evita duplicados gracias al UNIQUE de la tabla
  try {
    await PedidoIngestionJob.bulkCreate(rows, { ignoreDuplicates: true });
  } catch (e) {
    // si tu dialecto no soporta ignoreDuplicates, haz upsert manual o catch por clave duplicada
  }
  return uniq.length;
}

module.exports = { linkJobToPedidos };
