// const fs = require("fs");
// const path = require("path");
// const { generarExcelDesdePython } = require("./generarExcelDesdePython");
// // Si usas las versiones 'logged', importa esas:
// const { enviarCorreoConAdjuntoLogged, enviarCorreoDeErrorLogged } = require("../../services/email-logged.services");
// const { registrarPedido } = require("./pedido/registrarPedido");
// const { analizarYAgruparPorFactura } = require("../function/procesarMultipagina");
// const addressParser = require('nodemailer/lib/addressparser');
// const { Clientes } = require("../../models");
// const { Op } = require("sequelize");
// const crypto = require("crypto");


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

// /** Helpers para normalizar nombres de empresa (igual que en registrarPedido) */
// const limpiarNombreEmpresa = (nombre = "") =>
//   nombre
//     .toLowerCase()
//     .replace(/\s+(c\.?\s*a|s\.?\s*a)\b/gi, "")
//     .replace(/[.,]/g, "")
//     .replace(/\s+/g, " ")
//     .trim();

// async function buscarCodigoClientePorNombre(empresaRaw = "") {
//   if (!empresaRaw) return null;
//   const candidatoBase = empresaRaw.split(",")[0].trim();
//   const empresaLimpia = limpiarNombreEmpresa(empresaRaw);

//   const c = await Clientes.findOne({
//     where: {
//       [Op.or]: [
//         { nombre: { [Op.like]: `%${empresaRaw}%` } },
//         { nombre: { [Op.like]: `%${candidatoBase}%` } },
//         { nombre: { [Op.like]: `%${empresaLimpia}%` } },
//       ],
//     },
//   });
//   return c ? c.codigo : null;
// }

// function normalizarSegmentoClienteEnRuta(rutaAbs) {
//   const segs = rutaAbs.split(path.sep);
//   const i = segs.findIndex(s => s.toLowerCase() === "clientes");
//   if (i === -1 || i + 1 >= segs.length) return rutaAbs;

//   let limpio = segs[i + 1].replace(/,\s*$/, "");
//   limpio = limpio.replace(/,\s*C\.?\s*A\.?$/i, "");
//   limpio = limpio.replace(/\bC\.?\s*A\.?$/i, "");
//   limpio = limpio.replace(/\s+/g, " ").trim();
//   segs[i + 1] = limpio;
//   return segs.join(path.sep);
// }

// /**
//  * Procesa uno o varios PDF ya sea:
//  *  - ejecutando el análisis internamente (comportamiento de antes), o
//  *  - usando un pre-análisis que venga en opciones.preAnalisis para NO repetir Azure/split.
//  */
// // ... imports y helpers que ya tienes ...

// async function procesarArchivo(entrada, opciones = {}) {
//   const {
//     remitente = "nflores@neb.com.ve",
//     nombre = "archivo.pdf",
//     preAnalisis = null, // { porArchivo: [ { grupos, resumenJSON }, ... ], totalPaginas, azureMsTotal }
//     sourceId = null,
//   } = opciones;

//   const archivos = Array.isArray(entrada)
//     ? entrada.map(x => (Buffer.isBuffer(x) ? { buffer: x, nombre } : x))
//     : [{ buffer: entrada, nombre }];

//   const tmpDir = path.join(__dirname, "../../uploads/tmp");
//   await fs.promises.mkdir(tmpDir, { recursive: true });
//   const resumenPath = path.join(tmpDir, "resumen_multipedido.json");

//   // ID estable del correo para idempotencia
//   const correoId =
//     sourceId ||
//     crypto.createHash("sha1")
//       .update((Array.isArray(entrada) ? entrada : [entrada]).map(x => x?.nombre || nombre).join("|"))
//       .digest("hex")
//       .slice(0, 24);
//   try {
//     const productosNoEncontradosGlobal = [];
//     const pedidoIds = [];
//     let rutaClientePrimero = null;

//     const facturaToCodigo = new Map();
//     const resumenJSONGlobal = [];

//     const preArray = Array.isArray(preAnalisis?.porArchivo) ? preAnalisis.porArchivo : [];

//     for (let idxArchivo = 0; idxArchivo < archivos.length; idxArchivo++) {
//       const { buffer, nombre: nombreArchivo } = archivos[idxArchivo];
//       if (!Buffer.isBuffer(buffer)) {
//         throw new Error("❌ Se esperaba un buffer o un array de { buffer, nombre }.");
//       }

//       // 🟢 AHORA: usa el pre-análisis correspondiente a este archivo si existe
//       let grupos, resumenJSON;
//       if (preArray[idxArchivo]?.grupos) {
//         ({ grupos, resumenJSON } = preArray[idxArchivo]);
//       } else {
//         ({ grupos, resumenJSON } = await analizarYAgruparPorFactura(buffer)); // fallback
//       }

//       if (!grupos?.length) {
//         console.warn(`⚠ ${nombreArchivo}: no se detectaron facturas/pedidos válidos en el PDF.`);
//         continue;
//       }

//       for (const grupo of grupos) {
//         const { claveFactura, extractedData, productosNoEncontrados, buffers } = grupo;

//         const tieneItems =
//           Array.isArray(extractedData["Items Compra"]) &&
//           extractedData["Items Compra"].length > 0;

//         const tieneFaltantes =
//           Array.isArray(productosNoEncontrados) &&
//           productosNoEncontrados.length > 0;

//         if (!tieneItems && !tieneFaltantes) {
//           console.warn(`⚠ Factura ${claveFactura}: sin ítems ni faltantes. Se omite.`);
//           continue;
//         }

//         const resultado = await registrarPedido({
//           extractedData,
//           productosNoEncontrados,
//           buffer: buffers,     // páginas pertenecientes a ESA factura
//           nombrePDF: nombreArchivo,
//         });

//         console.log(extractedData)

//         if (resultado?.pedidoId) pedidoIds.push(resultado.pedidoId);

//         if (!rutaClientePrimero && resultado?.rutaClienteBase) {
//           rutaClientePrimero = normalizarSegmentoClienteEnRuta(resultado.rutaClienteBase);
//         }

//         const codeFromDetalle =
//           resultado?.extractedData?.["Items Compra"]?.[0]?.codigoCliente || null;
//         if (codeFromDetalle) {
//           facturaToCodigo.set(claveFactura, codeFromDetalle);
//         } else {
//           const empresa = resultado?.extractedData?.["Empresa"]?.valueString || "";
//           const code = await buscarCodigoClientePorNombre(empresa);
//           if (code) facturaToCodigo.set(claveFactura, code);
//         }

//         if (tieneFaltantes) {
//           productosNoEncontradosGlobal.push({
//             factura: claveFactura,
//             faltantes: productosNoEncontrados,
//           });
//         }
//       }

//       if (Array.isArray(resumenJSON) && resumenJSON.length) {
//         resumenJSONGlobal.push(...resumenJSON);
//       }
//     }

//     if (pedidoIds.length === 0 && productosNoEncontradosGlobal.length === 0) {
//       throw new Error("No se detectaron facturas/pedidos válidos en los PDF(s).");
//     }

//     // Enriquecer código cliente
//     for (const fac of resumenJSONGlobal) {
//       let codigo = facturaToCodigo.get(fac.numeroFactura);
//       if (!codigo) codigo = await buscarCodigoClientePorNombre(fac.empresa);
//       if (codigo) {
//         for (const it of fac.items || []) {
//           it.codigoCliente = it.codigoCliente || codigo;
//         }
//       }
//     }

//     const resumenParaExcel = resumenJSONGlobal.filter(
//       f => Array.isArray(f.items) && f.items.length > 0
//     );

//     let rutaExcelParaCorreo = null;

//     const destinatarioSeguro = parseFirstEmail(remitente) || ensureEmailLocal(remitente);


//     console.log(resumenPath, resumenParaExcel)

//     if (resumenParaExcel.length > 0 && rutaClientePrimero) {
//       await fs.promises.writeFile(
//         resumenPath,
//         JSON.stringify(resumenParaExcel, null, 2),
//         "utf-8"
//       );

//       const carpetaExcel = path.join(rutaClientePrimero, "excel");
//       await fs.promises.mkdir(carpetaExcel, { recursive: true });

//       const excelPath = await generarExcelDesdePython(resumenPath, carpetaExcel, pedidoIds);

//       rutaExcelParaCorreo = path.join(carpetaExcel, "E2O TA.xlsm");

//       // Tamaño origen
//       const srcSize = (await fs.promises.stat(excelPath)).size;

//       // Copiar y chequear
//       await fs.promises.copyFile(excelPath, rutaExcelParaCorreo);
//       const dstSize = (await fs.promises.stat(rutaExcelParaCorreo)).size;

//       console.log(`📏 Copia Excel src=${srcSize} bytes -> dst=${dstSize} bytes`);



//       if (dstSize < 5000) {
//         console.warn("⚠️ La copia parece vacía. Enviaré el archivo original para evitar Excel en blanco.");
//         // Si la copia salió rarísima (p.ej. por un tema de long path), usar el original directamente
//         await enviarCorreoConAdjuntoLogged(excelPath, [], {
//           empresa: "MÚLTIPLES",
//           nroFactura: "GLOBAL",
//           destinatario: destinatarioSeguro,
//           sourceId,
//           idempotencyKey: `excel:${correoId}`,
//         });
//       } else {
//         await enviarCorreoConAdjuntoLogged(rutaExcelParaCorreo, [], {
//           empresa: "MÚLTIPLES",
//           nroFactura: "GLOBAL",
//           destinatario: destinatarioSeguro,
//           sourceId,
//           idempotencyKey: `excel:${correoId}`,
//         });
//       }
//     } else {
//       console.warn("ℹ️ No hay facturas con ítems válidos o no se pudo determinar carpeta de cliente. Se omite generación de Excel.");
//     }

//     if (productosNoEncontradosGlobal.length > 0) {
//       await enviarCorreoDeErrorLogged(null, productosNoEncontradosGlobal, {
//         empresa: "MÚLTIPLES",
//         nroFactura: "GLOBAL",
//         destinatario: destinatarioSeguro,
//         sourceId,
//         idempotencyKey: `faltantes:${correoId}`,
//       });
//     }

//     try { if (rutaExcelParaCorreo) await fs.promises.unlink(rutaExcelParaCorreo); } catch { }
//     try { await fs.promises.unlink(resumenPath); } catch { }

//     return {
//       mensaje: `✅ Procesado: ${archivos.length} PDF(s). Facturas totales: ${resumenJSONGlobal.length}. Excel: ${resumenParaExcel.length > 0 ? "sí" : "no"}.`,
//       facturasProcesadas: resumenJSONGlobal.map(r => r.numeroFactura),
//       productosNoEncontradosGlobal,
//     };
//   } catch (error) {
//     try { await fs.promises.unlink(resumenPath); } catch { }
//     console.error("❌ Error en procesarArchivo:", error);
//     throw error;
//   }
// }

// module.exports = { procesarArchivo };


// utils/procesar-archivos/index.js
// utils/procesar-archivos/index.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const addressParser = require("nodemailer/lib/addressparser");
const { Op } = require("sequelize");

const { analizarYAgruparPorFactura } = require("../function/procesarMultipagina");
const { registrarPedido } = require("./pedido/registrarPedido");
const { enviarCorreoDeErrorLogged } = require("../../services/email-logged.services");
const { Clientes } = require("../../models");

// Azure SDKs
const { BlobServiceClient } = require("@azure/storage-blob");
const { QueueServiceClient } = require("@azure/storage-queue");

/* ===================== Helpers básicos ===================== */
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

const limpiarNombreEmpresa = (nombre = "") =>
  nombre
    .toLowerCase()
    .replace(/\s+(c\.?\s*a|s\.?\s*a)\b/gi, "")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function buscarCodigoClientePorNombre(empresaRaw = "") {
  if (!empresaRaw) return null;
  const candidatoBase = empresaRaw.split(",")[0].trim();
  const empresaLimpia = limpiarNombreEmpresa(empresaRaw);
  const c = await Clientes.findOne({
    where: {
      [Op.or]: [
        { nombre: { [Op.like]: `%${empresaRaw}%` } },
        { nombre: { [Op.like]: `%${candidatoBase}%` } },
        { nombre: { [Op.like]: `%${empresaLimpia}%` } },
      ],
    },
  });
  return c ? c.codigo : null;
}

function normalizarSegmentoClienteEnRuta(rutaAbs) {
  const segs = rutaAbs.split(path.sep);
  const i = segs.findIndex((s) => s.toLowerCase() === "clientes");
  if (i === -1 || i + 1 >= segs.length) return rutaAbs;
  let limpio = segs[i + 1].replace(/,\s*$/, "");
  limpio = limpio.replace(/,\s*C\.?\s*A\.?$/i, "");
  limpio = limpio.replace(/\bC\.?\s*A\.?$/i, "");
  limpio = limpio.replace(/\s+/g, " ").trim();
  segs[i + 1] = limpio;
  return segs.join(path.sep);
}

/* ===================== Azure helpers ===================== */
function getStorageConn() {
  return (
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
    process.env.AZ_ST_CONN ||
    process.env.AZ_QUEUE_CONN
  );
}
function getBlobAndQueueClients() {
  const conn = getStorageConn();
  if (!conn) throw new Error("Falta cadena de conexión (AZURE_STORAGE_CONNECTION_STRING / AZ_ST_CONN / AZ_QUEUE_CONN).");
  return {
    blobSvc: BlobServiceClient.fromConnectionString(conn),
    queueSvc: QueueServiceClient.fromConnectionString(conn),
  };
}

/**
 * Sube un array JSON al contenedor `input` como archivo único.
 * Devuelve { container, blobName, url }.
 */

// validar si no descomentar codigo
async function subirResumenJSON(resumenArray, nombreBase = "pedido") {
  const { blobSvc } = getBlobAndQueueClients();
  const container = "input";
  const containerClient = blobSvc.getContainerClient(container);
  await containerClient.createIfNotExists();

  const hash = crypto.createHash("sha1").update(JSON.stringify(resumenArray)).digest("hex").slice(0, 8);
  const blobName = `${nombreBase}_${Date.now()}_${hash}.json`;
  const blockBlob = containerClient.getBlockBlobClient(blobName);

  const body = Buffer.from(JSON.stringify(resumenArray, null, 2), "utf-8");
  await blockBlob.uploadData(body, {
    blobHTTPHeaders: { blobContentType: "application/json; charset=utf-8" },
  });

  return { container, blobName, url: blockBlob.url };
}


/**
 * Encola un mensaje en `procesar-excel` (base64 de JSON plano).
 * payload: { blob: 'pedido_*.json', outName?: 'E2O-TA-<ids>.xlsm', outPrefix?: 'carpeta' }
 */
async function ponerMensajeCola(payload) {
  const { queueSvc } = getBlobAndQueueClients();
  const queueClient = queueSvc.getQueueClient("procesar-excel");
  await queueClient.createIfNotExists();
  const content = JSON.stringify(payload);
  await queueClient.sendMessage(Buffer.from(content).toString("base64"));
}

/* ===================== Flujo principal ===================== */
async function procesarArchivo(entrada, opciones = {}) {
  const {
    remitente = "nflores@neb.com.ve",
    nombre = "archivo.pdf",
    preAnalisis = null, // { porArchivo: [ { grupos, resumenJSON }, ... ] }
    sourceId = null,
    asunto = null,
  } = opciones;

  const archivos = Array.isArray(entrada)
    ? entrada.map((x) => (Buffer.isBuffer(x) ? { buffer: x, nombre } : x))
    : [{ buffer: entrada, nombre }];

  const tmpDir = path.join(__dirname, "../../uploads/tmp");
  await fs.promises.mkdir(tmpDir, { recursive: true });

  const kpiGlobal = { itemsOk: 0, itemsFail: 0, montoOk: 0, montoFail: 0, montoAll: 0 };



  const correoId =
    sourceId ||
    crypto
      .createHash("sha1")
      .update((Array.isArray(entrada) ? entrada : [entrada]).map((x) => x?.nombre || nombre).join("|"))
      .digest("hex")
      .slice(0, 24);

  try {
    const productosNoEncontradosGlobal = [];
    const pedidoIds = [];
    let rutaClientePrimero = null;

    const facturaToCodigo = new Map();
    const resumenJSONGlobal = [];

    const preArray = Array.isArray(preAnalisis?.porArchivo) ? preAnalisis.porArchivo : [];

    for (let idxArchivo = 0; idxArchivo < archivos.length; idxArchivo++) {
      const { buffer, nombre: nombreArchivo } = archivos[idxArchivo];
      if (!Buffer.isBuffer(buffer)) {
        throw new Error("❌ Se esperaba un buffer o un array de { buffer, nombre }.");
      }

      // Usa pre-análisis si viene; si no, analiza local
      let grupos, resumenJSON;
      if (preArray[idxArchivo]?.grupos) {
        ({ grupos, resumenJSON } = preArray[idxArchivo]);
      } else {
        ({ grupos, resumenJSON } = await analizarYAgruparPorFactura(buffer));
      }

      if (!grupos?.length) {
        console.warn(`⚠ ${nombreArchivo}: no se detectaron facturas/pedidos válidos en el PDF.`);
        continue;
      }

      for (const grupo of grupos) {
        const { claveFactura, extractedData, productosNoEncontrados, buffers } = grupo;

        const tieneItems =
          Array.isArray(extractedData["Items Compra"]) &&
          extractedData["Items Compra"].length > 0;

        const tieneFaltantes =
          Array.isArray(productosNoEncontrados) && productosNoEncontrados.length > 0;

        if (!tieneItems && !tieneFaltantes) {
          console.warn(`⚠ Factura ${claveFactura}: sin ítems ni faltantes. Se omite.`);
          continue;
        }

        const resultado = await registrarPedido({
          extractedData,
          productosNoEncontrados,
          buffer: buffers,
          nombrePDF: nombreArchivo,
        });

        const k = resultado?.kpi || {};
        kpiGlobal.itemsOk += Number(k.itemsOk || 0);
        kpiGlobal.itemsFail += Number(k.itemsFail || 0);
        kpiGlobal.montoOk += Number(k.montoOk || 0);
        kpiGlobal.montoFail += Number(k.montoFail || 0);
        kpiGlobal.montoAll += Number(k.montoAll || 0);



        if (resultado?.pedidoId) pedidoIds.push(resultado.pedidoId);

        if (!rutaClientePrimero && resultado?.rutaClienteBase) {
          rutaClientePrimero = normalizarSegmentoClienteEnRuta(resultado.rutaClienteBase);
        }

        const codeFromDetalle =
          resultado?.extractedData?.["Items Compra"]?.[0]?.codigoCliente || null;
        if (codeFromDetalle) {
          facturaToCodigo.set(claveFactura, codeFromDetalle);
        } else {
          const empresa = resultado?.extractedData?.["Empresa"]?.valueString || "";
          const code = await buscarCodigoClientePorNombre(empresa);
          if (code) facturaToCodigo.set(claveFactura, code);
        }

        if (tieneFaltantes) {
          productosNoEncontradosGlobal.push({
            factura: claveFactura,
            faltantes: productosNoEncontrados,
          });
        }
      }

      if (Array.isArray(resumenJSON) && resumenJSON.length) {
        resumenJSONGlobal.push(...resumenJSON);
      }
    }

    // Nada útil
    if (pedidoIds.length === 0 && productosNoEncontradosGlobal.length === 0) {
      throw new Error("No se detectaron facturas/pedidos válidos en los PDF(s).");
    }

    // Enriquecer códigos cliente (para el Excel)
    for (const fac of resumenJSONGlobal) {
      let codigo = facturaToCodigo.get(fac.numeroFactura);
      if (!codigo) codigo = await buscarCodigoClientePorNombre(fac.empresa);
      if (codigo) {
        for (const it of fac.items || []) {
          it.codigoCliente = it.codigoCliente || codigo;
        }
      }
    }

    // Filtra facturas con ítems (las que van a Excel)
    const resumenParaExcel = resumenJSONGlobal.filter(
      (f) => Array.isArray(f.items) && f.items.length > 0
    );
const destinatarioSeguro = parseFirstEmail(remitente) || ensureEmailLocal(remitente)
    // === NUEVO: subir JSON a Storage/input y mandar a Queue ===
    let queuePayload = null;
    if (resumenParaExcel.length > 0) {
      // Nombre de salida (útil para correlación por Event Grid/webhook)
      const idsStr = pedidoIds.length ? pedidoIds.join("_") : Date.now();
      const outName = `E2O-TA-${idsStr}.xlsm`;

      // Sube JSON (lo que antes guardabas como resumen_multipedido.json)
      // comentado si no funciona descomentar
      const { blobName, url } = await subirResumenJSON(resumenParaExcel, "pedido");
      //           const { blobName, url } = await subirResumenJSON(resumenParaExcel, "pedido", {
      //   replyTo: remitente,     // <-- el correo que recibiste del origen
      //   pedidoId: pedidoIds[0], // opcional
      //   extraMeta: { source: "webhook-in" }
      // });
      // Importante: el watcher espera SOLO el nombre (sin 'input/')
      // y ya conoce el contenedor `input`.

      // Encola mensaje para el watcher
      queuePayload = {
        blob: blobName,          // ej: "pedido_1693512345678_ab12cd34.json"
        outName,                 // ej: "E2O-TA-12_13.xlsm"
        outPrefix: "pruebas",     // opcional: subcarpeta virtual en 'output/'
        replyTo: destinatarioSeguro,
        Asunto: asunto // << para metadata del Excel
      };
      await ponerMensajeCola(queuePayload);

      console.log("📤 JSON subido a input:", url);
      console.log("📨 Mensaje enviado a cola:", queuePayload);
    } else {
      console.warn("ℹ️ No hay facturas con ítems válidos. No se envía a la cola.");
    }

    // Correo de faltantes (si hay)
    
    if (productosNoEncontradosGlobal.length > 0) {
      await enviarCorreoDeErrorLogged(null, productosNoEncontradosGlobal, {
        empresa: "MÚLTIPLES",
        nroFactura: "GLOBAL",
        destinatario: destinatarioSeguro,
        sourceId,
        idempotencyKey: `faltantes:${correoId}`,
        Asunto: asunto
      });
    }

    const pedidoIdsUnicos = Array.from(new Set(pedidoIds));
    return {
      mensaje: `✅ Procesado: ${archivos.length} PDF(s). Facturas totales: ${resumenJSONGlobal.length}. Encolado Excel: ${resumenParaExcel.length > 0 ? "sí" : "no"
        }.`,
      facturasProcesadas: resumenJSONGlobal.map((r) => r.numeroFactura),
      encolado: queuePayload,
      productosNoEncontradosGlobal,
      pedidoId: pedidoIdsUnicos[0] || null,   // compatibilidad (uno)
      pedidoIds: pedidoIdsUnicos,             // todos los pedidos generados por este/estos PDF(s)
      kpi: kpiGlobal,
    };
  } catch (error) {
    console.error("❌ Error en procesarArchivo:", error);
    throw error;
  }
}

module.exports = { procesarArchivo };
