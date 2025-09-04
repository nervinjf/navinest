const router = require("express").Router();
const { Op, fn, col, literal } = require("sequelize");

// Models
const EmailInbound = require("../models/EmailInbound.models");
const IngestionJob = require("../models/IngestionJob.models");
const AzureDailyUsage = require("../models/AzureDailyUsage.models");
const Pedidos = require("../models/pedidos.models");
const Clientes = require("../models/clientes.models");
const DetallePedidos = require("../models/detallePedidos.models");

// ---------- helpers rango ----------
function tsRange({ from, to }) {
  if (!from && !to) return null;
  const w = {};
  if (from) w[Op.gte] = new Date(`${from}T00:00:00.000Z`);
  if (to)   w[Op.lt]  = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 24*60*60*1000);
  return w;
}
function dateOnlyWhere({ from, to }) {
  if (from && to) return { [Op.between]: [from, to] };
  if (from)       return { [Op.gte]: from };
  if (to)         return { [Op.lte]: to };
  return null;
}

// ---------- OVERVIEW (una sola llamada) ----------
router.get("/overview", async (req, res, next) => {
  try {
    let { from, to, status, q, page = 1, limit = 20 } = req.query;
    page = Math.max(1, Number(page) || 1);
    limit = Math.min(100, Math.max(1, Number(limit) || 20));

    // filtros comunes
    const emailWhere = {};
    const emailRange = tsRange({ from, to });
    if (emailRange) emailWhere.receivedAt = emailRange;

    const jobsWhere = {};
    const jobsRange = tsRange({ from, to });
    if (jobsRange) jobsWhere.startedAt = jobsRange;
    if (status) jobsWhere.status = status;

    const likeOp =
      IngestionJob.sequelize.getDialect() === "postgres" ? Op.iLike : Op.like;

    // pedidos
    const pedidosWhere = {};
    const fechaWhere = dateOnlyWhere({ from, to });
    if (fechaWhere) pedidosWhere.fecha_pedido = fechaWhere;
    if (status) {
      const map = {
        processed: "procesado",
        processing: "en_espera",
        queued: "en_espera",
        partial: "en_espera",
        error: "error",
      };
      pedidosWhere.estado = map[String(status).toLowerCase()] || status;
    }

    // ---------- consultas paralelas ----------
    const [
      inboundCount,
      totalJobs,
      processedJobs,
      queuedJobs,
      processingJobs,
      errorJobs,
      avgAzureRow,
      azureByDay,
      jobsListData,
      pedidosRows,
      pedidosCount,
    ] = await Promise.all([
      EmailInbound.count({ where: emailWhere }),

      IngestionJob.count({ where: jobsWhere }),
      IngestionJob.count({ where: { ...jobsWhere, status: "processed" } }),
      IngestionJob.count({ where: { ...jobsWhere, status: "queued" } }),
      IngestionJob.count({ where: { ...jobsWhere, status: "processing" } }),
      IngestionJob.count({ where: { ...jobsWhere, status: "error" } }),

      IngestionJob.findOne({
        attributes: [[fn("AVG", col("azure_duration_ms")), "avg_azure_ms"]],
        where: { ...jobsWhere, azureDurationMs: { [Op.ne]: null } },
        raw: true,
      }),

      AzureDailyUsage.findAll({
        where: { ...(from || to ? { date: dateOnlyWhere({ from, to }) } : {}) },
        attributes: ["date", ["pages_processed", "pagesProcessed"]],
        order: [["date", "ASC"]],
        raw: true,
      }),

      IngestionJob.findAndCountAll({
        where: {
          ...jobsWhere,
          ...(q
            ? {
                [Op.or]: [
                  { filePath: { [likeOp]: `%${q}%` } },
                  { sourceId: { [likeOp]: `%${q}%` } },
                ],
              }
            : {}),
        },
        order: [["startedAt", "DESC"]],
        limit,
        offset: (page - 1) * limit,
      }),

      Pedidos.findAll({
        attributes: [
          "id",
          ["fecha_pedido", "fecha"],
          "estado",
          "archivo_pdf",
          "nombre",
          // si existe columna monto_usd, la traemos; igual la recalcularemos por detalle
          ["monto_usd", "montoUsd"],
          [
            literal(
              `(SELECT COUNT(*) FROM detalle_pedidos d WHERE d.pedido_id = pedidos.id)`
            ),
            "items",
          ],
        ],
        include: [
          {
            model: Clientes,
            as: "cliente",
            attributes: ["nombre"],
            where: q ? { nombre: { [likeOp]: `%${q}%` } } : undefined,
            required: !!q,
          },
        ],
        where: pedidosWhere,
        order: [["id", "DESC"]],
        limit: 50,
      }),

      Pedidos.count({
        where: pedidosWhere,
        include: q
          ? [
              {
                model: Clientes,
                as: "cliente",
                required: true,
                where: { nombre: { [likeOp]: `%${q}%` } },
              },
            ]
          : [],
        distinct: true,
      }),
    ]);

    // === Agregados por pedido desde detalle_pedidos ===
    const pedidoIds = (pedidosRows || []).map((r) => (r.get ? r.get("id") : r.id));
    let detalleAgg = [];
    if (pedidoIds.length) {
      // Condición FAIL (dialecto-agnóstico vía LOWER LIKE)
      const failCond = literal(
        "(COALESCE(is_not_found, 0) = 1 OR LOWER(COALESCE(observacion_conversion,'')) LIKE '%no encontrado%')"
      );

      detalleAgg = await DetallePedidos.findAll({
        attributes: [
          ["pedido_id", "pedidoId"],
          // montos
          [fn("SUM", literal(`CASE WHEN ${failCond.val} THEN COALESCE(total_linea_usd,0) ELSE 0 END`)), "montoFailUsd"],
          [fn("SUM", literal(`CASE WHEN ${failCond.val} THEN 0 ELSE COALESCE(total_linea_usd,0) END`)), "montoOkUsd"],
          // contadores
          [fn("SUM", literal(`CASE WHEN ${failCond.val} THEN 1 ELSE 0 END`)), "itemsFail"],
          [fn("SUM", literal(`CASE WHEN ${failCond.val} THEN 0 ELSE 1 END`)), "itemsOk"],
        ],
        where: { pedidoId: { [Op.in]: pedidoIds } },
        group: ["pedido_id"],
        raw: true,
      });
    }

    const aggMap = new Map();
    for (const a of detalleAgg) {
      aggMap.set(Number(a.pedidoId), {
        montoOkUsd: Number(a.montoOkUsd || 0),
        montoFailUsd: Number(a.montoFailUsd || 0),
        itemsOk: Number(a.itemsOk || 0),
        itemsFail: Number(a.itemsFail || 0),
      });
    }

    // Derivados (Azure)
    const pagesTotal = (azureByDay || []).reduce(
      (a, r) => a + (Number(r.pagesProcessed) || 0),
      0
    );
    const avgAzureMs = Number(avgAzureRow?.avg_azure_ms || 0);

    // Normalización de pedidos + sumas globales
    let usdOkTotal = 0,
      usdFailTotal = 0,
      itemsOkTotal = 0,
      itemsFailTotal = 0,
      withFailCount = 0;

    const shareMap = new Map();

    const pedidos = (pedidosRows || []).map((r) => {
      const p = r.get ? r.get({ plain: true }) : r;
      const cli = p.cliente?.nombre || p.nombre || "—";
      const agg = aggMap.get(p.id) || {
        montoOkUsd: 0,
        montoFailUsd: 0,
        itemsOk: 0,
        itemsFail: 0,
      };

      usdOkTotal += agg.montoOkUsd;
      usdFailTotal += agg.montoFailUsd;
      itemsOkTotal += agg.itemsOk;
      itemsFailTotal += agg.itemsFail;
      if (agg.itemsFail > 0) withFailCount += 1;

      shareMap.set(cli, (shareMap.get(cli) || 0) + 1);

      return {
        id: p.id,
        fecha: p.fecha,
        estado: p.estado,
        items: Number(p.items || 0),
        cliente: cli,
        archivo_pdf: p.archivo_pdf || null,
        // montos por pedido (desde detalle)
        montoOkUsd: agg.montoOkUsd,
        montoFailUsd: agg.montoFailUsd,
        itemsOk: agg.itemsOk,
        itemsFail: agg.itemsFail,
        // monto total (por si quieres mostrar una sola cifra)
        montoUsd: agg.montoOkUsd + agg.montoFailUsd,
      };
    });

    const clientsShare = Array.from(shareMap.entries()).map(([name, count]) => ({
      name,
      count,
    }));

    // respuesta
    res.json({
      range: { from, to },

      emails: { inbound: inboundCount },

      pdfs: {
        total: totalJobs,
        processed: processedJobs,
        queued: queuedJobs,
        processing: processingJobs,
        error: errorJobs,
        processed_pct: totalJobs ? processedJobs / totalJobs : 0,
      },

      azure: {
        by_day: azureByDay, // [{date, pagesProcessed}]
        pages_total: pagesTotal,
        avg_azure_ms: avgAzureMs,
      },

      queue: {
        processing: processingJobs,
        queued: queuedJobs,
        error: errorJobs,
      },

      jobs: {
        total: jobsListData.count,
        page,
        limit,
        rows: jobsListData.rows,
      },

      // ===== Pedidos + KPIs desde detalle_pedidos =====
      orders: {
        total: pedidosCount,
        rows: pedidos,
        // $ totales por estado de línea
        usd_ok_total: usdOkTotal,
        usd_fail_total: usdFailTotal,
        // conteos de líneas
        items_ok_total: itemsOkTotal,
        items_fail_total: itemsFailTotal,
        // "excels fallados" ~ pedidos con alguna línea fallida
        with_fail_count: withFailCount,
        // share para el gráfico
        clients_share: clientsShare,
      },
    });
  } catch (e) {
    console.error(e);
    next(e);
  }
});

module.exports = router;
