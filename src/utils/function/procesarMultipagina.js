// procesarMultipagina.js
const { extraerDatosDesdePDF } = require("../procesar archivos/extraerDatos");
const { extractFields } = require("../procesar archivos/fieldsDB"); // tu archivo existente
const { splitPDFIntoPages } = require("./pdf");

async function analizarYAgruparPorFactura(pdfBuffer) {
  const { pagesBuffers, totalPages } = await splitPDFIntoPages(pdfBuffer);
  const gruposMap = new Map();
  let azureMsTotal = 0; // ⬅ acumulador

  for (let idx = 0; idx < pagesBuffers.length; idx++) {
    const pageBuffer = pagesBuffers[idx];

    // 1) Azure → fields
    const { fields, azureMs } = await extraerDatosDesdePDF(pageBuffer);
    azureMsTotal += (azureMs || 0);
    // 2) Normalizar con tu extractFields

   
    const { extractedData, productosNoEncontrados } = await extractFields(fields);

    // 3) Clave de agrupación por factura/pedido
    const claveFactura =
      extractedData?.["N Factura"]?.valueString?.trim() ||
      extractedData?.["Numero de Pedido"]?.valueString?.trim() ||
      `SIN_FACTURA_PAG_${idx + 1}`;

    // 4) Crear/merge grupo
    if (!gruposMap.has(claveFactura)) {
      gruposMap.set(claveFactura, {
        claveFactura,
        extractedData: {
          ...extractedData,
          ["Items Compra"]: Array.isArray(extractedData?.["Items Compra"])
            ? [...extractedData["Items Compra"]]
            : [],
        },
        productosNoEncontrados: Array.isArray(productosNoEncontrados) ? [...productosNoEncontrados] : [],
        paginas: [idx + 1],
        buffers: [pageBuffer], // guardamos el buffer de esta página
      });
    } else {
      const g = gruposMap.get(claveFactura);

      const itemsPrev = Array.isArray(g.extractedData["Items Compra"]) ? g.extractedData["Items Compra"] : [];
      const itemsNew = Array.isArray(extractedData?.["Items Compra"]) ? extractedData["Items Compra"] : [];
      g.extractedData["Items Compra"] = itemsPrev.concat(itemsNew);

      if (Array.isArray(productosNoEncontrados) && productosNoEncontrados.length) {
        g.productosNoEncontrados = g.productosNoEncontrados.concat(productosNoEncontrados);
      }

      g.extractedData["Empresa"] = g.extractedData["Empresa"] || extractedData["Empresa"];
      g.extractedData["Fecha Factura"] = g.extractedData["Fecha Factura"] || extractedData["Fecha Factura"];

      g.paginas.push(idx + 1);
      g.buffers.push(pageBuffer);
    }
  }

  // Resumen compacto (array por factura)
  const resumenJSON = [];
  for (const [, g] of gruposMap) {
    resumenJSON.push({
      numeroFactura: g.extractedData?.["N Factura"]?.valueString || g.claveFactura,
      fechaFactura: g.extractedData?.["Fecha Factura"]?.valueString || null,
      empresa: g.extractedData?.["Empresa"]?.valueString || null,
      items: Array.isArray(g.extractedData?.["Items Compra"]) ? g.extractedData["Items Compra"] : [],
    });
  }

  return {
    grupos: Array.from(gruposMap.values()),
    resumenJSON,
    totalPaginas: totalPages,
    azureMsTotal, // ⬅ devolvemos suma del tiempo Azure DI
  };
}

module.exports = { analizarYAgruparPorFactura };
