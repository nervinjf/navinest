const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { Pedidos, DetallePedidos, Clientes, Productos } = require("../../../models");
const { Op, fn, col, literal } = require("sequelize");
const { mergePDFBuffers } = require("../../function/pdf");
const { uploadBufferToBlob } = require("../../../middlewares/azureBlob");

// --- utilidades -----------------------------
// Quita coma final y elimina "C.A"/"C.A."/ "CA" o "S.A"/"S.A."/ "SA" SOLO si están al final
function normalizarNombreClienteFinal(nombre = "") {
  let out = String(nombre).trim();

  // quita coma al final (con espacios)
  out = out.replace(/,\s*$/, "");

  // quita variantes al final: , C.A. / C.A / CA  (y lo mismo con S.A.)
  out = out.replace(/,\s*(C\.?\s*A\.?|S\.?\s*A\.?)\s*$/i, "");
  out = out.replace(/\b(C\.?\s*A\.?|S\.?\s*A\.?)\s*$/i, "");

  // colapsa espacios
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

const INVALID_FS = /[<>:"/\\|?*\x00-\x1F]/g; // windows invalids
const toSafeName = (s = "") =>
  String(s).replace(INVALID_FS, "").replace(/\s+/g, " ").trim();
const onlyFileSafe = (s = "") =>
  String(s).replace(/[^A-Za-z0-9_\-\.]/g, "_"); // para nombres de archivo

// Reemplaza tu limpiarNombreEmpresa por esta versión
const limpiarNombreEmpresa = (nombre = "") =>
  nombre
    .toLowerCase()
    .replace(/\s+(c\.?\s*a|s\.?\s*a)\b/gi, "") // quita "C.A", "C A", "CA", "S.A", etc.
    .replace(/[.,]/g, "")                      // luego quita puntuación
    .replace(/\s+/g, " ")
    .trim();


const toNumber = (v) => {
  if (v == null) return null;
  const s = String(v).replace(/\./g, "").replace(",", "."); // 1.234,56 → 1234.56
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
// --------------------------------------------

/**
 * @param {Object} params
 * @param {Object} params.extractedData
 * @param {Array}  params.productosNoEncontrados
 * @param {Buffer|Buffer[]} params.buffer  // 1 o varios buffers (páginas de la misma factura)
 * @param {String} params.nombrePDF
 */
async function registrarPedido({ extractedData, productosNoEncontrados, buffer, nombrePDF }) {
  const buffers = Array.isArray(buffer) ? buffer : [buffer];
  if (!buffers.length) throw new Error("No se recibieron buffers de PDF.");

  // Datos base
  const empresaRaw = extractedData["Empresa"]?.valueString || "Desconocido";
  if (!empresaRaw) throw new Error("❌ No se pudo extraer el nombre del cliente desde el PDF.");

  const clienteFolderName = normalizarNombreClienteFinal(empresaRaw);

  const nroFacturaRaw = extractedData["N Factura"]?.valueString || "SIN_FACTURA";



  // Sanitizar para FS
  const empresaFS = toSafeName(clienteFolderName);
  const nroFacturaFS = onlyFileSafe(nroFacturaRaw);

  const fechaActual = new Date();
  const anio = fechaActual.getFullYear();
  const mes = String(fechaActual.getMonth() + 1).padStart(2, "0");

  // Rutas
  const rutaClienteBase = path.join(__dirname, "../../../uploads/Clientes", empresaFS, anio.toString(), mes);
  const carpetaPDF = path.join(rutaClienteBase, "pdf");
  const carpetaOriginales = path.join(carpetaPDF, "originales");

  await fsp.mkdir(carpetaOriginales, { recursive: true });

  // Buscar cliente por nombre limpio (no “%forum%” fijo)
  const candidatoBase = empresaRaw.split(",")[0].trim(); // ej: "FORUM SUPER MAYORISTA"
  const clienteNombreLimpio = limpiarNombreEmpresa(empresaRaw);
  const clienteEncontrado = await Clientes.findOne({
    where: {
      [Op.or]: [
        { nombre: { [Op.like]: `%${empresaRaw}%` } },   // tal cual viene
        { nombre: { [Op.like]: `%${candidatoBase}%` } },      // antes de la coma
        { nombre: { [Op.like]: `%${clienteNombreLimpio}%` } } // limpio
      ]
    }
  });
  if (!clienteEncontrado) {
    throw new Error(`❌ Cliente no encontrado en la base de datos para: ${empresaRaw}`);
  }

  // Completar codigoCliente en items y asegurar cantidades numéricas
  extractedData["Items Compra"] = (extractedData["Items Compra"] || []).map(item => {
    const cant = toNumber(item.Cantidad);
    return {
      ...item,
      Cantidad: cant != null ? cant : item.Cantidad
    };
  });

  // Guardar originales
  const fechaStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0].replace("T", "_");
  const rutasOriginales = [];
  for (let i = 0; i < buffers.length; i++) {
    const nombreArchivoPDF = `${nroFacturaFS}_${fechaStamp}_${String(i + 1).padStart(2, "0")}.pdf`;
    const rutaPDF = path.join(carpetaOriginales, nombreArchivoPDF);
    await fsp.writeFile(rutaPDF, buffers[i]);
    rutasOriginales.push(rutaPDF);
  }

  // Mapa de fuentes (auditoría)
  const rutaMapa = path.join(carpetaPDF, `mapa_${nroFacturaFS}.json`);
  let mapa = { factura: nroFacturaRaw, fuentes: [] };
  if (fs.existsSync(rutaMapa)) {
    try { mapa = JSON.parse(await fsp.readFile(rutaMapa, "utf-8")); } catch { }
  }
  const setFuentes = new Set(mapa.fuentes || []);
  for (const r of rutasOriginales) setFuentes.add(r);
  mapa.fuentes = Array.from(setFuentes);
  await fsp.writeFile(rutaMapa, JSON.stringify(mapa, null, 2), "utf-8");

  // Merge: COMBINADO previo (si existe) + nuevas fuentes
  const rutaCombinadoPath = path.join(carpetaPDF, `COMBINADO_${nroFacturaFS}.pdf`);
  const buffersParaMerge = [];
  if (fs.existsSync(rutaCombinadoPath)) {
    buffersParaMerge.push(await fsp.readFile(rutaCombinadoPath));
  }
  for (const p of mapa.fuentes) {
    buffersParaMerge.push(await fsp.readFile(p));
  }

  const combinadoBuffer = await mergePDFBuffers(buffersParaMerge);

  const blobName = `${anio}/${mes}/${nroFacturaFS}_${fechaStamp}.pdf`;

  let rutaCombinado; // 👈 salida final: URL del blob o path local si cae en fallback
  try {
    const info = await uploadBufferToBlob({
      container: "pdf",
      blobName,
      buffer: combinadoBuffer,
      contentType: "application/pdf",
    });
    rutaCombinado = info.url;         // URL en Blob
    console.log("☁️ COMBINADO subido a Blob:", rutaCombinado);
  } catch (e) {
    console.error("❌ Falló subir a Blob. Fallback a FS:", e.message);
    const rutaTmp = rutaCombinadoPath + ".tmp";
    await fsp.writeFile(rutaTmp, combinadoBuffer);
    await fsp.rename(rutaTmp, rutaCombinadoPath);
    rutaCombinado = rutaCombinadoPath; // path local como fallback
  }

  // Borrar originales y limpiar mapa
  try {
    for (const ruta of mapa.fuentes) {
      if (fs.existsSync(ruta)) await fsp.unlink(ruta);
    }
    mapa.fuentes = [];
    await fsp.writeFile(rutaMapa, JSON.stringify(mapa, null, 2), "utf-8");
    console.log(`🗑️ Originales de ${nroFacturaRaw} eliminados`);
  } catch (err) {
    console.error(`⚠️ Error borrando originales de ${nroFacturaRaw}:`, err);
  }

  // Estado del pedido
 const itemsCompra = Array.isArray(extractedData["Items Compra"])
  ? extractedData["Items Compra"]
  : [];

const productosNoEncontrados2 = Array.isArray(productosNoEncontrados)
  ? productosNoEncontrados
  : [];

let estado;
if (itemsCompra.length > 0 && productosNoEncontrados2.length === 0) {
  estado = "Procesado";
} else if (itemsCompra.length > 0 && productosNoEncontrados2.length > 0) {
  estado = "Procesado parcial";
} else if (itemsCompra.length === 0 && productosNoEncontrados2.length > 0) {
  estado = "Sin procesar";
} else {
  estado = "Sin datos"; // por si ambos están vacíos
}

  // Crear/actualizar Pedido (una fila por factura)
  let pedido = await Pedidos.findOne({
    where: {
      clienteId: clienteEncontrado.id,
      nombre: nroFacturaRaw
    }
  });

  if (!pedido) {
    pedido = await Pedidos.create({
      clienteId: clienteEncontrado.id,
      fecha_pedido: fechaActual,
      archivo_pdf: rutaCombinado,
      nombre: nroFacturaRaw,
      estado
    });
  } else {
    await pedido.update({
      archivo_pdf: rutaCombinado,
      estado
    });
  }

  // Insertar detalle (simple). Si quieres evitar duplicados: verifica antes.
  const items = extractedData["Items Compra"] || [];
  for (const item of items) {
    const prod = await Productos.findOne({ where: { codigoSAP: item.Material } });
    const productoId = prod ? prod.id : null;

    function toNumberStrict(v) {
      if (typeof v === "number") return v;
      if (v == null) return 0;

      let s = String(v).trim();
      if (!s) return 0;

      const hasComma = s.includes(",");
      const hasDot = s.includes(".");

      if (hasComma && hasDot) {
        // el separador decimal es el último que aparezca
        const lastComma = s.lastIndexOf(",");
        const lastDot = s.lastIndexOf(".");
        const decSep = lastComma > lastDot ? "," : ".";
        const thouSep = decSep === "," ? "." : ",";
        s = s.split(thouSep).join("").replace(decSep, ".");
        return parseFloat(s) || 0;
      }

      if (hasComma) s = s.replace(",", ".");
      return parseFloat(s) || 0;
    }

    // intenta leer total de línea del item si viene en el PDF (Total/Monto/SubTotal...)
    // si no existe, déjalo en null (luego puedes calcularlo externamente)
    function toMoneyMaybe(v) {
      if (v == null) return null;
      let s = String(v).trim();
      if (!s) return null;
      // quita símbolos de moneda y espacios
      s = s.replace(/\s*(USD|US\$|\$|Bs\.?|VEF|VES)\s*/gi, "");
      const hasComma = s.includes(",");
      const hasDot = s.includes(".");
      if (hasComma && hasDot) {
        const lastComma = s.lastIndexOf(",");
        const lastDot = s.lastIndexOf(".");
        const decSep = lastComma > lastDot ? "," : ".";
        const thouSep = decSep === "," ? "." : ",";
        s = s.split(thouSep).join("").replace(decSep, ".");
      } else if (hasComma) {
        s = s.replace(",", ".");
      }
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : null;
    }


    const totalLinea =
      (item.TotalLineaUsd != null ? Number(item.TotalLineaUsd) : null) ??
      toMoneyMaybe(item["Neto Factur"] ?? item["Neto Factura"] ?? item.Neto ?? item.Importe ?? item.Total ?? item.SubTotal ?? null);


    // si NO hubo match de producto => es 'no encontrado' en esta línea
    const isNF = !productoId;

    await DetallePedidos.create({
      pedidoId: pedido.id,
      cantidad: toNumberStrict(item.Cantidad),
      productoId: productoId ?? 2555, // tu fallback
      observacionConversion: productoId ? null :
        `No encontrado (durante detalle): ${item.Description || ""} (${item.Material || ""})`,
      totalLineaUsd: totalLinea,               // ahora viene de "Neto Factur" si existe
      is_not_found: !productoId               // <-- marca no-encontrado cuando no hubo match
    });


  }

  // Registrar no encontrados
  if (Array.isArray(productosNoEncontrados)) {
    for (const ne of productosNoEncontrados) {
      await DetallePedidos.create({
        pedidoId: pedido.id,
        cantidad: 0,
        productoId: 320, // tu "producto no encontrado"
        observacionConversion: `No encontrado: ${ne.descripcion || ""} (${ne.material || ""})`,
        totalLineaUsd: ne.totalLineaUsd != null ? Number(ne.totalLineaUsd) : null,
        // is_not_found: true   // <-- requiere columna; comenta si aún no la tienes
      });
    }
  }

  // Heurística de "no encontrado": por flag o por texto (compatibilidad)
  // const isNFCond = [
  //   // si tienes columna booleana:
  //   { is_not_found: true },
  //   // fallback por texto:
  //   where(col("observacion_conversion"), { [Op.iLike]: "%no encontrado%" })
  // ];

 const agregados = await DetallePedidos.findAll({
  where: { pedidoId: pedido.id },
  attributes: [
    // SUM de montos en fallas (por texto)
    [fn('SUM', literal(`IF(LOWER(observacion_conversion) LIKE '%no encontrado%', COALESCE(total_linea_usd,0), 0)`)), 'sum_fail_txt'],
    // SUM de montos en fallas (por flag)
    [fn('SUM', literal(`IF(is_not_found = 1, COALESCE(total_linea_usd,0), 0)`)), 'sum_fail_flag'],

    // SUM de montos OK (por texto)
    [fn('SUM', literal(`IF(LOWER(observacion_conversion) LIKE '%no encontrado%', 0, COALESCE(total_linea_usd,0))`)), 'sum_ok_txt'],
    // SUM de montos OK (por flag)
    [fn('SUM', literal(`IF(is_not_found = 1, 0, COALESCE(total_linea_usd,0))`)), 'sum_ok_flag'],

    // contadores
    [fn('SUM', literal(`IF(LOWER(observacion_conversion) LIKE '%no encontrado%', 1, 0)`)), 'cnt_fail_txt'],
    [fn('SUM', literal(`IF(is_not_found = 1, 1, 0)`)), 'cnt_fail_flag'],
    [fn('SUM', literal(`IF(LOWER(observacion_conversion) LIKE '%no encontrado%', 0, 1)`)), 'cnt_ok_txt'],
    [fn('SUM', literal(`IF(is_not_found = 1, 0, 1)`)), 'cnt_ok_flag'],

    // total general
    [fn('SUM', col('total_linea_usd')), 'sum_all'],
  ],
  raw: true,
});

const A = agregados?.[0] || {};
const sumFail = Number(A.sum_fail_flag ?? A.sum_fail_txt ?? 0);
const sumOk   = Number(A.sum_ok_flag   ?? A.sum_ok_txt   ?? 0);
const sumAll  = Number(A.sum_all ?? (sumOk + sumFail));
const cntFail = Number(A.cnt_fail_flag ?? A.cnt_fail_txt ?? 0);
const cntOk   = Number(A.cnt_ok_flag   ?? A.cnt_ok_txt   ?? 0);

await pedido.update({
  montoOkUsd:   sumOk,
  montoFailUsd: sumFail,
  montoUsd:     sumAll,
  items_ok_count:   cntOk,
  items_fail_count: cntFail,
});

  await pedido.update({
    montoOkUsd: sumOk,
    montoFailUsd: sumFail,
    montoUsd: sumAll,
    // si agregaste columnas (opcionales) en pedidos:
    items_ok_count: cntOk,
    items_fail_count: cntFail
  });



  return {
    pedidoId: pedido.id,
    pedidoIds: [pedido.id], 
    estado: pedido.estado,
    mensaje: "✅ Pedido registrado/actualizado correctamente.",
    rutaClienteBase,
    rutaPDFCombinado: rutaCombinado,
    rutasOriginales,
    extractedData,
    // KPIs rápidos
    kpi: {
      itemsOk: cntOk,
      itemsFail: cntFail,
      montoOk: sumOk,
      montoFail: sumFail,
      montoAll: sumAll
    }
  };
}

module.exports = { registrarPedido };
