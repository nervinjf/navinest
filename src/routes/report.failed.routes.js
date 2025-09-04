// routes/report.failed.routes.js
const router = require("express").Router();
const { Op } = require("sequelize");
const IngestionJob = require("../models/IngestionJob.models");
const EmailInbound = require("../models/EmailInbound.models");

function tsRange({ from, to }) {
  if (!from && !to) return null;
  const w = {};
  if (from) w[Op.gte] = new Date(`${from}T00:00:00.000Z`);
  if (to)   w[Op.lt]  = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 24*60*60*1000);
  return w;
}

router.get("/failed-pdfs", async (req, res, next) => {
  try {
    let { page = 1, limit = 20, from, to, q = "", onlyErrors = "false", staleMinutes } = req.query;
    page  = Math.max(1, Number(page)  || 1);
    limit = Math.min(100, Math.max(1, Number(limit) || 20));

    const likeOp = IngestionJob.sequelize.getDialect() === "postgres" ? Op.iLike : Op.like;
    const range  = tsRange({ from, to });

    // Umbral de “atascados”
    const mins   = Number(staleMinutes || process.env.FAILED_STALE_MINUTES || 15);
    const cutoff = new Date(Date.now() - mins * 60 * 1000);

    // 1) errores reales
    const condErrors = { status: "error" };

    // 2) procesados con problema (líneas fallidas o sin pedido)
    const condProcessedWithIssue = {
      status: { [Op.in]: ["processed", "partial"] },
      [Op.or]: [
        { hasFailLine: true },
        { pedidoId: null }
      ],
    };

    // 3) atascados (queued/processing sin pedido y viejos)
    const condStalled = {
      status: { [Op.in]: ["queued", "processing"] },
      pedidoId: null,
      startedAt: { [Op.lt]: cutoff }
    };

    // Búsqueda libre
    const condSearch = q
      ? {
          [Op.or]: [
            { filePath: { [likeOp]: `%${q}%` } },
            { pdfName:  { [likeOp]: `%${q}%` } },
            { sourceId: { [likeOp]: `%${q}%` } },
          ],
        }
      : {};

    // Rango de fechas aplicado sobre startedAt
    const condRange = range ? { startedAt: range } : {};

    // Si piden sólo errores puros
    const baseOr = String(onlyErrors).toLowerCase() === "true"
      ? [condErrors]
      : [condErrors, condProcessedWithIssue, condStalled];

    const where = {
      [Op.and]: [
        { [Op.or]: baseOr }, // (A) bloque OR con paréntesis explícitos
        condRange,           // (B) rango
        condSearch           // (C) búsqueda
      ],
    };

    const { rows, count } = await IngestionJob.findAndCountAll({
      where,
      include: [{
        model: EmailInbound,
        as: "emailInbound",
        required: false,
        attributes: ["messageId", "fromAddr", "toAddr", "subject", "receivedAt"],
      }],
      order: [["startedAt", "DESC"]],
      offset: (page - 1) * limit,
      limit,
    });

    res.json({ total: count, page, limit, rows, cutoff });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
