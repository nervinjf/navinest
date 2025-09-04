// // services/attachment-processor.service.js
// const path = require("path");
// const fs = require("fs");
// const { createJob, finishJobOk, finishJobError } = require("./telemetry.services");
// const { analizarYAgruparPorFactura } = require("../utils/function/procesarMultipagina");
// const { procesarArchivo } = require("../utils/procesar archivos/index");
// const addressParser = require('nodemailer/lib/addressparser');
// const crypto = require("crypto");
// const { IngestionJob, Pedidos, DetallePedidos } = require("../models");


// // Helpers KPI: calcula flags desde detalle_pedidos (rápido y exacto)
// async function computePedidoFlags(pedidoId) {
//   const rows = await DetallePedidos.findAll({
//     where: { pedidoId },
//     attributes: ["observacionConversion", "totalLineaUsd"],
//     raw: true,
//   });

//   let hasOk = false, hasFail = false;
//   for (const r of rows) {
//     const obs = (r.observacionConversion || "").toLowerCase();
//     const isNF = obs.includes("no encontrado");
//     if (isNF) hasFail = true; else hasOk = true;
//     if (hasOk && hasFail) break;
//   }
//   return { hasOkLine: hasOk, hasFailLine: hasFail };
// }

// function sha256(buf) {
//   return crypto.createHash("sha256").update(buf).digest("hex");
// }

// function parseFirstEmail(input) {
//   if (!input) return null;
//   try {
//     const parsed = addressParser(String(input));
//     const first = parsed?.[0];
//     const email = first?.address?.trim();
//     return email || null;
//   } catch {
//     return null;
//   }
// }
// function ensureEmailLocal(v) {
//   if (typeof v === 'string' && v.includes('@')) return v.trim();
//   return process.env.DEFAULT_REPORT_EMAIL || 'nflores@neb.com.ve';
// }


// async function procesarPDFsDeCorreoConJob({
//   archivos,
//   origen,
//   sourceId,
//   azureModelId,
//   remitente = process.env.DEFAULT_REPORT_EMAIL,
//   jobsSeed = []   // <-- evita ReferenceError aunque no lo uses
// }) {
//   if (!Array.isArray(archivos) || archivos.length === 0) {
//     throw new Error("No hay archivos PDF para procesar.");
//   }

//   const destinatarioSeguro = parseFirstEmail(remitente) || ensureEmailLocal(remitente);

//   const prePorArchivo = [];
//   let totalPaginas = 0;
//   let azureMsTotal = 0;

//   for (const { buffer, nombre } of archivos) {
//     const { grupos, resumenJSON, totalPaginas: pgs, azureMsTotal: ms } =
//       await analizarYAgruparPorFactura(buffer);

//     prePorArchivo.push({
//       grupos,
//       resumenJSON,
//       metaArchivo: {
//         nombre,
//         sha256: sha256(buffer),
//         sizeBytes: buffer.length,
//       }
//     });

//     totalPaginas += (pgs || 0);
//     azureMsTotal += (ms || 0);
//   }

//   const job = await createJob({
//     source: origen || "email",
//     sourceId,
//     clienteId: null,
//     pedidoId: null,
//     filePath: path.join("emails_procesados", `${sourceId}.zip`),
//     azureModelId,
//     pagesDetected: totalPaginas
//   });


//   // Si el listener ya creó 1 job por PDF, guardamos hash/size a nivel job
//   if (Array.isArray(jobsSeed) && jobsSeed.length === archivos.length) {
//     for (let i = 0; i < jobsSeed.length; i++) {
//       const id = jobsSeed[i];
//       const meta = prePorArchivo[i]?.metaArchivo;
//       try {
//         await IngestionJob.update(
//           {
//             // Si añadiste estas columnas, genial; si no, omite:
//             filePath: meta?.nombre || null,
//             fileHashSha256: meta?.sha256 || null,
//             fileSizeBytes: meta?.sizeBytes || null,
//           },
//           { where: { id } }
//         );
//       } catch (e) {
//         // si aún no tienes columnas fileHashSha256/fileSizeBytes, ignora
//       }
//     }
//   }


//   try {
//    const result = await procesarArchivo(archivos, {
//   remitente: destinatarioSeguro,
//   preAnalisis: { porArchivo: prePorArchivo, totalPaginas, azureMsTotal },
//   sourceId
// });

// // Normaliza a array de pedidos
// const pedidoIds = Array.isArray(result?.pedidoIds)
//   ? result.pedidoIds
//   : (result?.pedidoId || result?.idpedido ? [result.pedidoId || result.idpedido] : []);

// // Calcula flags agregados (si alguno falla, el global marca fail)
// let hasOkLine = false;
// let hasFailLine = false;

// for (const pid of pedidoIds) {
//   const flags = await computePedidoFlags(pid);
//   hasOkLine  = hasOkLine  || !!flags.hasOkLine;
//   hasFailLine = hasFailLine || !!flags.hasFailLine;
//   if (hasOkLine && hasFailLine) break; // ya tenemos ambos
// }

// // 1) Enlaza N<->M (job ↔ todos los pedidos)
//     if (pedidoIds.length) {
//       await linkJobToPedidos(job.id, pedidoIds);
//     }

// // Enlaza el job "global" al primer pedido (compat) + flags
// try {
//   await IngestionJob.update(
//     {
//       pedidoId: pedidoIds[0] || null,
//       hasOkLine,
//       hasFailLine,
//       // opcional si agregas esta columna en el modelo:
//       // pedidoIdsJson: pedidoIds.length ? JSON.stringify(pedidoIds) : null
//     },
//     { where: { id: job.id } }
//   );
// } catch { /* noop */ }

// // Si hay jobsSeed (uno por PDF), propaga flags y el primer pedido
// if (Array.isArray(jobsSeed) && jobsSeed.length === archivos.length) {
//   for (const id of jobsSeed) {
//     try {
//       await IngestionJob.update(
//         { pedidoId: pedidoIds[0] || null, hasOkLine, hasFailLine },
//         { where: { id } }
//       );
//     } catch { /* noop */ }
//   }
// }


//     await finishJobOk(job, {
//       azureOperationId: null,
//       pagesAzure: totalPaginas,
//       azureDurationMs: azureMsTotal,
//       status: "processed"
//     });
//   } catch (e) {
//     await finishJobError(job, { errorDetails: String(e?.message || e).slice(0, 4000) });
//     throw e;
//   }
// }

// module.exports = { procesarPDFsDeCorreoConJob };

// ------------------------\\\\\\\\\\\\\\\\\intento dos pendiente \\\\\\\\\\\\\\\\\\\\\\\\\-------------------------------

// services/attachment-processor.service.js
const path = require("path");
const fs = require("fs");
const { createJob, finishJobOk, finishJobError } = require("./telemetry.services");
const { analizarYAgruparPorFactura } = require("../utils/function/procesarMultipagina");
const { procesarArchivo } = require("../utils/procesar archivos/index");
const addressParser = require("nodemailer/lib/addressparser");
const crypto = require("crypto");
const { IngestionJob, Pedidos, DetallePedidos } = require("../models");
const { linkJobToPedidos } = require("./Report/pedido-job-link.services");

// 👇 IMPORTANTE: helper que enlaza N↔M (job ↔ pedidos)

// ===== Helpers =====
async function computePedidoFlags(pedidoId) {
  const rows = await DetallePedidos.findAll({
    where: { pedidoId },
    attributes: ["observacionConversion", "totalLineaUsd"],
    raw: true,
  });

  let hasOk = false, hasFail = false;
  for (const r of rows) {
    const obs = (r.observacionConversion || "").toLowerCase();
    const isNF = obs.includes("no encontrado");
    if (isNF) hasFail = true; else hasOk = true;
    if (hasOk && hasFail) break;
  }
  return { hasOkLine: hasOk, hasFailLine: hasFail };
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}
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
  if (typeof v === "string" && v.includes("@")) return v.trim();
  return process.env.DEFAULT_REPORT_EMAIL || "nflores@neb.com.ve";
}

// ===== Principal =====
async function procesarPDFsDeCorreoConJob({
  archivos,
  origen,
  sourceId,
  azureModelId,
  remitente = process.env.DEFAULT_REPORT_EMAIL,
  jobsSeed = [],           // IDs de jobs creados por el listener (uno por PDF)
  globalJobId,              // <<<<<< añadido
  reuseGlobalJob = false,   // <<<<<< añadido
}) {
  if (!Array.isArray(archivos) || archivos.length === 0) {
    throw new Error("No hay archivos PDF para procesar.");
  }

  const destinatarioSeguro = parseFirstEmail(remitente) || ensureEmailLocal(remitente);

  // Preanálisis por archivo (split + ocr/azure hecho 1 sola vez)
  const prePorArchivo = [];
  let totalPaginas = 0;
  let azureMsTotal = 0;

  for (const { buffer, nombre } of archivos) {
    const { grupos, resumenJSON, totalPaginas: pgs, azureMsTotal: ms } =
      await analizarYAgruparPorFactura(buffer);

    prePorArchivo.push({
      grupos,
      resumenJSON,
      metaArchivo: {
        nombre,
        sha256: sha256(buffer),
        sizeBytes: buffer.length,
      },
    });

    totalPaginas += Number(pgs || 0);
    azureMsTotal += Number(ms || 0);
  }

  // Job "global" para este correo/lote
  let job;
  if (reuseGlobalJob && globalJobId) {
    // 🔁 Reusar job existente (retry)
    job = await IngestionJob.findByPk(globalJobId);
    if (!job) throw new Error(`globalJobId=${globalJobId} no existe`);
    // refresca métricas mínimas
    await IngestionJob.update(
      { pagesDetected: totalPaginas, azureModelId: azureModelId || job.azureModelId },
      { where: { id: job.id } }
    );
  } else {
    // 🆕 Flujo normal: crear job global nuevo
    job = await createJob({
      source: origen || "email",
      sourceId,
      clienteId: null,
      pedidoId: null, // compat: se completa al final con el primer pedido
      filePath: path.join("emails_procesados", `${sourceId}.zip`),
      azureModelId,
      pagesDetected: totalPaginas,
    });
  }

 // Si el listener ya creó 1 job por PDF, guarda hash/size en cada jobSeed
  if (Array.isArray(jobsSeed) && jobsSeed.length === archivos.length) {
    for (let i = 0; i < jobsSeed.length; i++) {
      const id = jobsSeed[i];
      const meta = prePorArchivo[i]?.metaArchivo;
      try {
        await IngestionJob.update(
          {
            filePath: meta?.nombre || null,     // si quieres: guarda el nombre de ese PDF en el jobSeed
            fileHashSha256: meta?.sha256 || null,
            fileSizeBytes: meta?.sizeBytes || null,
          },
          { where: { id } }
        );
      } catch {}
    }
  }

  try {
    // Procesamiento con preAnálisis (no repite Azure)
    const result = await procesarArchivo(archivos, {
      remitente: destinatarioSeguro,
      preAnalisis: { porArchivo: prePorArchivo, totalPaginas, azureMsTotal },
      sourceId,
    });

    // Normaliza a array TODOS los pedidos generados
    const pedidoIds = Array.isArray(result?.pedidoIds)
      ? result.pedidoIds
      : (result?.pedidoId || result?.idpedido ? [result.pedidoId || result.idpedido] : []);

    // Calcula flags agregados a partir de TODOS los pedidos
    let hasOkLine = false;
    let hasFailLine = false;
    for (const pid of pedidoIds) {
      const flags = await computePedidoFlags(pid);
      hasOkLine = hasOkLine || !!flags.hasOkLine;
      hasFailLine = hasFailLine || !!flags.hasFailLine;
      if (hasOkLine && hasFailLine) break; // ya tenemos ambos
    }

    // 1) Enlaza N↔M (job global ↔ todos los pedidos)
    if (pedidoIds.length) {
      await linkJobToPedidos(job.id, pedidoIds);
    }

    // 2) Compat: guarda “primer pedido” en el job global + flags
    const firstPedidoId = pedidoIds[0] || null;
    try {
      await IngestionJob.update(
        {
          pedidoId: firstPedidoId,
          hasOkLine,
          hasFailLine,
          // Si agregaste columna JSON opcional:
          // pedidoIdsJson: pedidoIds.length ? JSON.stringify(pedidoIds) : null
        },
        { where: { id: job.id } }
      );
    } catch { }

    // 3) Propaga a jobsSeed (uno por PDF): enlace N↔M + compat
    if (Array.isArray(jobsSeed) && jobsSeed.length === archivos.length) {
      for (const id of jobsSeed) {
        try {
          if (pedidoIds.length) {
            await linkJobToPedidos(id, pedidoIds);
          }
          await IngestionJob.update(
            { pedidoId: firstPedidoId, hasOkLine, hasFailLine },
            { where: { id } }
          );
        } catch { }
      }
    }

    // Finaliza OK
    await finishJobOk(job, {
      azureOperationId: null,
      pagesAzure: totalPaginas,
      azureDurationMs: azureMsTotal,
      status: "processed",
    });
  } catch (e) {
    // Finaliza con error y propaga
    await finishJobError(job, { errorDetails: String(e?.message || e).slice(0, 4000) });
    throw e;
  }
}

module.exports = { procesarPDFsDeCorreoConJob };
