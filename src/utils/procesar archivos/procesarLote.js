const fs = require("fs");
const path = require("path");
const { analizarYAgruparPorFactura } = require("../function/procesarMultipagina");
const { registrarPedido } = require("./pedido/registrarPedido");
const { generarExcelDesdePython } = require("./generarExcelDesdePython");
const { enviarCorreoConAdjuntoLogged, enviarCorreoDeErrorLogged } = require("../../services/email-logged.services");

function yyyymm() {
  const d = new Date();
  return { anio: String(d.getFullYear()), mes: String(d.getMonth() + 1).padStart(2, "0") };
}

/**
 * Procesa un lote de PDFs (buffers) en un solo Excel global.
 * @param {Array<{buffer:Buffer, nombre:string}>} archivos
 * @param {{remitente?:string}} opciones
 */
async function procesarLoteDePDFs(archivos, opciones = {}) {
  const { remitente = "nflores@neb.com.ve" } = opciones;

  // carpeta temporal para el JSON global (fuera de src)
  const tmpDir = path.join(__dirname, "../../uploads/tmp");
  await fs.promises.mkdir(tmpDir, { recursive: true });
  const resumenPath = path.join(tmpDir, "resumen_multipedido.json");

  // Carpeta de salida del Excel global (neutral, no por cliente)
  const { anio, mes } = yyyymm();
  const carpetaExcelGlobal = path.join(__dirname, `../../uploads/ExcelGlobal/${anio}/${mes}/excel`);
  await fs.promises.mkdir(carpetaExcelGlobal, { recursive: true });

  const resumenJSONGlobal = [];
  const productosNoEncontradosGlobal = [];
  const pedidoIds = [];

  try {
    // Procesar cada PDF adjunto del correo
    for (const file of archivos) {
      const { buffer, nombre } = file;
      if (!Buffer.isBuffer(buffer)) continue;

      const { grupos, resumenJSON } = await analizarYAgruparPorFactura(buffer);

      // registrar pedidos por cada factura agrupada en este PDF
      for (const grupo of grupos) {
        const { claveFactura, extractedData, productosNoEncontrados, buffers } = grupo;

        if (!Array.isArray(extractedData["Items Compra"]) || extractedData["Items Compra"].length === 0) {
          console.warn(`⚠ Factura ${claveFactura}: sin items válidos. Se omite.`);
          continue;
        }

        const res = await registrarPedido({
          extractedData,
          productosNoEncontrados,
          buffer: buffers,       // todas las páginas de esa factura
          nombrePDF: nombre
        });

        if (res?.pedidoId) pedidoIds.push(res.pedidoId);

        if (Array.isArray(productosNoEncontrados) && productosNoEncontrados.length) {
          productosNoEncontradosGlobal.push({ factura: claveFactura, faltantes: productosNoEncontrados });
        }
      }

      // acumular resumen de este PDF al global
      if (Array.isArray(resumenJSON) && resumenJSON.length) {
        resumenJSONGlobal.push(...resumenJSON);
      }
    }

    // Escribir SOLO el JSON global y generar UN Excel global
    await fs.promises.writeFile(resumenPath, JSON.stringify(resumenJSONGlobal, null, 2), "utf-8");

    const rutaExcel = await generarExcelDesdePython(resumenPath, carpetaExcelGlobal, pedidoIds);
    const rutaExcelParaCorreo = path.join(carpetaExcelGlobal, "E2O TA.xlsm");
    await fs.promises.copyFile(rutaExcel, rutaExcelParaCorreo);

    // 1) Correo con el Excel global
    await enviarCorreoConAdjuntoLogged(rutaExcelParaCorreo, [], {
      empresa: "MÚLTIPLES",
      nroFactura: "GLOBAL",
      destinatario: remitente
    });

    // 2) Correo aparte con faltantes (si hubo)
    if (productosNoEncontradosGlobal.length > 0) {
      await enviarCorreoDeErrorLogged(
        null, // sin adjunto
        productosNoEncontradosGlobal,
        { empresa: "MÚLTIPLES", nroFactura: "GLOBAL", destinatario: remitente }
      );
    }

    // Limpieza
    try { await fs.promises.unlink(rutaExcelParaCorreo); } catch {}
    try { await fs.promises.unlink(resumenPath); } catch {}

    return {
      mensaje: `✅ Lote procesado. PDFs: ${archivos.length}, facturas: ${resumenJSONGlobal.length}.`,
      pedidoIds,
      productosNoEncontradosGlobal
    };
  } catch (err) {
    try { await fs.promises.unlink(resumenPath); } catch {}
    console.error("❌ Error procesando lote:", err);
    throw err;
  }
}

module.exports = { procesarLoteDePDFs };
