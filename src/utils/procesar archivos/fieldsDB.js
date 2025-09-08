// const { ProductosClientes, Clientes, Productos, Sucursales } = require("../../models");
// const { Op } = require("sequelize");

// /** Helpers numéricos */
// function toNumberStrict(v) {
//   if (typeof v === "number") return v;
//   if (v == null) return 0;
//   let s = String(v).trim();
//   if (!s) return 0;

//   // quita símbolos de moneda ($, Bs, USD, etc.)
//   s = s.replace(/\s*(USD|US\$|\$|Bs\.?|VEF|VES)\s*/gi, "");

//   const hasComma = s.includes(",");
//   const hasDot = s.includes(".");

//   if (hasComma && hasDot) {
//     const lastComma = s.lastIndexOf(",");
//     const lastDot = s.lastIndexOf(".");
//     const decSep = lastComma > lastDot ? "," : ".";
//     const thouSep = decSep === "," ? "." : ",";
//     s = s.split(thouSep).join("").replace(decSep, ".");
//     return parseFloat(s) || 0;
//   }
//   if (hasComma) s = s.replace(",", ".");
//   return parseFloat(s) || 0;
// }

// function toMoneyMaybe(v) {
//   if (v == null) return null;
//   let s = String(v).trim();
//   if (!s) return null;
//   s = s.replace(/\s*(USD|US\$|\$|Bs\.?|VEF|VES)\s*/gi, "");
//   const hasComma = s.includes(",");
//   const hasDot = s.includes(".");
//   if (hasComma && hasDot) {
//     const lastComma = s.lastIndexOf(",");
//     const lastDot = s.lastIndexOf(".");
//     const decSep = lastComma > lastDot ? "," : ".";
//     const thouSep = decSep === "," ? "." : ",";
//     s = s.split(thouSep).join("").replace(decSep, ".");
//   } else if (hasComma) {
//     s = s.replace(",", ".");
//   }
//   const n = parseFloat(s);
//   return Number.isFinite(n) ? n : null;
// }

// /** Lee el TOTAL de la línea desde el objeto del PDF */
// function pickLineTotalFromItemObject(obj) {
//   // Nombres típicos: "Neto Factur", "Neto Factura", "Neto", "Importe", "ImporteNeto"
//   const candidates = [
//     obj["Neto Factur"], obj["Neto Factura"], obj.Neto, obj.Importe, obj.ImporteNeto, obj.Total, obj.SubTotal
//   ];
//   for (const c of candidates) {
//     const m = toMoneyMaybe(c);
//     if (m != null) return m;
//   }
//   return null;
// }

// /** Busca vínculo cliente-producto + joins habituales */
// async function obtenerCodigoDesdeDB(codigo, sucu) {
//   try {
//     const producto = await ProductosClientes.findOne({
//       where: { codigoCliente: { [Op.like]: `%${codigo}%` } },
//       include: [
//         { model: Productos, as: "producto" },
//         {
//           model: Clientes,
//           as: "cliente",
//           include: [{
//             model: Sucursales,
//             as: "sucursales",
//             required: true,
//             where: {
//               [Op.or]: [
//                 { codigo:   { [Op.like]: `%${sucu}%` } },
//                 { sucursal: { [Op.like]: `%${sucu}%` } },
//               ]
//             }
//           }]
//         }
//       ]
//     });
//     return producto || null;
//   } catch (e) {
//     console.log(e);
//     return null;
//   }
// }

// /** === FUNCIÓN PRINCIPAL === */
// async function extractFields(fields) {
//   const extractedData = {};
//   const productosNoEncontrados = [];
//   const codigosInactivos = ["Inactivar", "Inactivo", "Inactivo In & Out"];

//   for (const key in fields) {
//     const field = fields[key];

//     if (field?.valueString) {
//       extractedData[key] = { valueString: field.valueString };
//     }

//     if (field?.type === "array" && field.valueArray?.length) {
//       const lista = [];

//       for (const item of field.valueArray) {
//         if (item.type === "object" && item.valueObject) {
//           // 1) Volcar valueString de cada subcampo a objectData
//           let objectData = {};
//           for (const subKey in item.valueObject) {
//             if (item.valueObject[subKey]?.valueString) {
//               objectData[subKey] = item.valueObject[subKey].valueString;
//             }
//           }

//           // 2) Solo filas con descripción válida
//           if (!objectData.Description) {
//             // sin descripción, lo ignoramos
//             continue;
//           }

//           // 3) Cantidad desde el PDF (numérica)
//           const cantidadPDF = toNumberStrict(objectData.Cantidad);

//           // 4) Intentar mapear a SKU interno usando sucursal del documento
//           const sucursalDoc = fields["Sucursal"]?.valueString;
//           const vinculo = await obtenerCodigoDesdeDB(objectData.Material, sucursalDoc);

//           // 5) TOTAL DE LÍNEA desde el PDF (Neto Factur)
//           const totalLinea = pickLineTotalFromItemObject(objectData); // <- **aquí** usamos "Neto Factur"
//           // Unitario derivado (solo informativo, no obligatorio)
//           const unitarioDerivado = (totalLinea != null && cantidadPDF > 0)
//             ? Number(totalLinea) / Number(cantidadPDF)
//             : null;

//           const esActivo = (pc) => {
//             const estadoPC   = (pc?.estado || "").trim().toLowerCase();
//             if (estadoPC === "activo") return true;
//             const estadoProd = (pc?.producto?.estado_vigente || "").trim().toLowerCase();
//             return estadoProd === "activo";
//           };

//           if (vinculo && esActivo(vinculo)) {
//             // 6) Ajuste por conversión del cliente (tu lógica)
//             let cantidadConv = cantidadPDF;
//             if (vinculo.cliente?.requiere_conversion) {
//               const keyConv = vinculo.cliente.conversion;        // ej. "factor_caja"
//               const factor  = vinculo.producto.get(keyConv);
//               if (factor) cantidadConv = cantidadPDF / Number(factor);
//             }

//             // 7) Completar campos existentes
//             objectData.Material = vinculo.producto.codigoSAP;
//             objectData.NumeroFactura = fields["N Factura"]?.valueString || "SIN_FACTURA";
//             objectData.codigoCliente = vinculo.cliente?.sucursales?.[0]?.codigo || objectData.codigoCliente;

//             const salesOrg = vinculo?.producto?.SalesOrg || "";
//             const mapping = { "AlimentosyBebidas": "- A&B", "Purina": "- NPP", "Confites": "- C", "Professional": "- Prof" };
//             for (const k of Object.keys(mapping)) {
//               if (salesOrg.includes(k)) {
//                 objectData.cust = objectData.NumeroFactura + " " + mapping[k];
//                 break;
//               }
//             }
//             objectData.sales = vinculo.producto.SalesOrg;

//             // 8) Sobrescribir cantidad (convertida) y setear montos
//             objectData.Cantidad = cantidadConv;
//             objectData.TotalLineaUsd     = (totalLinea != null) ? Number(totalLinea) : null; // <- ¡de "Neto Factur"!
//             objectData.PrecioUnitarioUsd = (unitarioDerivado != null) ? Number(unitarioDerivado) : null;

//             // push a ítems OK
//             lista.push(objectData);

//           } else if (
//             objectData.Material &&
//             objectData.Description &&
//             objectData.Material.toUpperCase() !== "CODIGO" &&
//             objectData.Material.toUpperCase() !== "CÓDIGO PRODUCTO"
//           ) {
//             // Ítem NO encontrado: guardamos cantidad y total si vinieron
//             productosNoEncontrados.push({
//               material:    objectData.Material,
//               descripcion: objectData.Description,
//               cantidad:    cantidadPDF || 0,
//               // aquí el "total" sigue siendo el Neto de la línea
//               totalLineaUsd: (totalLinea != null) ? Number(totalLinea) : 0,
//               precioUnitarioUsd: (unitarioDerivado != null) ? Number(unitarioDerivado) : null,
//               codigo: "No encontrado"
//             });
//           }
//         }
//       }

//       extractedData[key] = lista;
//     }
//   }

//   console.log(productosNoEncontrados)

//   return { extractedData, productosNoEncontrados };
// }

// module.exports = { extractFields };

const { ProductosClientes, Clientes, Productos, Sucursales } = require("../../models");
const { Op } = require("sequelize");

/** Helpers numéricos */
function toNumberStrict(v) {
  if (typeof v === "number") return v;
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;

  // quita símbolos de moneda ($, Bs, USD, etc.)
  s = s.replace(/\s*(USD|US\$|\$|Bs\.?|VEF|VES)\s*/gi, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
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

function toMoneyMaybe(v) {
  if (v == null) return null;
  let s = String(v).trim();
  if (!s) return null;
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

/** Lee el TOTAL de la línea desde el objeto del PDF */
function pickLineTotalFromItemObject(obj) {
  // Nombres típicos: "Neto Factur", "Neto Factura", "Neto", "Importe", "ImporteNeto"
  const candidates = [
    obj["Neto Factur"], obj["Neto Factura"], obj.Neto, obj.Importe, obj.ImporteNeto, obj.Total, obj.SubTotal
  ];
  for (const c of candidates) {
    const m = toMoneyMaybe(c);
    if (m != null) return m;
  }
  return null;
}

/** Busca vínculo cliente-producto + joins habituales */
async function obtenerCodigoDesdeDB(codigo, sucu) {
  try {
    console.log(codigo)
    const producto = await ProductosClientes.findOne({
      where: { codigoCliente: { [Op.like]: `%${codigo}%` } },
      include: [
        { model: Productos, as: "producto" },
        {
          model: Clientes,
          as: "cliente",
          include: [{
            model: Sucursales,
            as: "sucursales",
            required: true,
            where: {
              [Op.or]: [
                { codigo:   { [Op.like]: `%${sucu}%` } },
                { sucursal: { [Op.like]: `%${sucu}%` } },
              ]
            }
          }]
        }
      ]
    });
    console.log(producto)
    return producto || null;
  } catch (e) {
    console.log(e);
    return null;
  }
}

/** === FUNCIÓN PRINCIPAL === */
async function extractFields(fields) {
  const extractedData = {};
  const productosNoEncontrados = [];
  const codigosInactivos = ["Inactivar", "Inactivo", "Inactivo In & Out"];

  for (const key in fields) {
    const field = fields[key];

    if (field?.valueString) {
      extractedData[key] = { valueString: field.valueString };
    }

    if (field?.type === "array" && field.valueArray?.length) {
      const lista = [];

      for (const item of field.valueArray) {
        if (item.type === "object" && item.valueObject) {
          // 1) Volcar valueString de cada subcampo a objectData
          let objectData = {};
          for (const subKey in item.valueObject) {
            if (item.valueObject[subKey]?.valueString) {
              objectData[subKey] = item.valueObject[subKey].valueString;
            }
          }

          // 2) Solo filas con descripción válida
          if (!objectData.Description) {
            // sin descripción, lo ignoramos
            continue;
          }

          // 3) Cantidad desde el PDF (numérica)
          const cantidadPDF = toNumberStrict(objectData.Cantidad);

          // 4) Intentar mapear a SKU interno usando sucursal del documento
          const sucursalDoc = fields["Sucursal"]?.valueString;
          const vinculo = await obtenerCodigoDesdeDB(objectData.Material, sucursalDoc);

          // 5) TOTAL DE LÍNEA desde el PDF (Neto Factur)
       const totalLinea = pickLineTotalFromItemObject(objectData);
const unitarioDerivado = (totalLinea != null && cantidadPDF > 0)
  ? Number(totalLinea) / Number(cantidadPDF)
  : null;

const esActivo = (pc) => {
  const estadoPC   = (pc?.estado || "").trim().toLowerCase();
  if (estadoPC === "activo") return true;
  const estadoProd = (pc?.producto?.estado_vigente || "").trim().toLowerCase();
  return estadoProd === "activo";
};

          const estadoTexto = (pc) => pc?.estado || pc?.producto?.estado_vigente || "inactivo";

         if (vinculo && esActivo(vinculo)) {
  // === ENCONTRADO Y ACTIVO (igual que antes) ===
  let cantidadConv = cantidadPDF;
  if (vinculo.cliente?.requiere_conversion) {
    const keyConv = vinculo.cliente.conversion;
    const factor  = vinculo.producto.get(keyConv);
    if (factor) cantidadConv = cantidadPDF / Number(factor);
  }

  objectData.Material        = vinculo.producto.codigoSAP;
  objectData.NumeroFactura   = fields["N Factura"]?.valueString || "SIN_FACTURA";
  objectData.codigoCliente   = vinculo.cliente?.sucursales?.[0]?.codigo || objectData.codigoCliente;

  const salesOrg = vinculo?.producto?.SalesOrg || "";
  const mapping = { "AlimentosyBebidas": "- A&B", "Purina": "- NPP", "Confites": "- C", "Professional": "- Prof" };
  for (const k of Object.keys(mapping)) {
    if (salesOrg.includes(k)) {
      objectData.cust = objectData.NumeroFactura + " " + mapping[k];
      break;
    }
  }
  objectData.sales = vinculo.producto.SalesOrg;

  objectData.Cantidad          = cantidadConv;
  objectData.TotalLineaUsd     = (totalLinea != null) ? Number(totalLinea) : null;
  objectData.PrecioUnitarioUsd = (unitarioDerivado != null) ? Number(unitarioDerivado) : null;

  lista.push(objectData);

} else if (vinculo && !esActivo(vinculo)) {
  // === NEW: ENCONTRADO PERO INACTIVO ===
  productosNoEncontrados.push({
    motivo: "inactivo",                              // NEW
    sucursal: sucursalDoc || "SIN_SUCURSAL",         // NEW
    encontradoEnBD: true,                            // NEW
    estado: estadoTexto(vinculo),                    // NEW (o usa vinculo?.estado || vinculo?.producto?.estado_vigente)
    codigoSAP: vinculo?.producto?.codigoSAP || null, // NEW ← lo que pediste
    codigoClienteSugerido: vinculo?.codigoCliente || null, // NEW (opcional)

    // datos del PDF para trazabilidad
    materialOriginal: objectData.Material,           // NEW
    descripcion: objectData.Description,             // NEW
    cantidad: cantidadPDF || 0,                      // NEW
    totalLineaUsd: (totalLinea != null) ? Number(totalLinea) : 0,         // NEW
    precioUnitarioUsd: (unitarioDerivado != null) ? Number(unitarioDerivado) : null, // NEW
  });

} else if (
  objectData.Material &&
  objectData.Description &&
  objectData.Material.toUpperCase() !== "CODIGO" &&
  objectData.Material.toUpperCase() !== "CÓDIGO PRODUCTO"
) {
  // === NO ENCONTRADO EN BD ===
  productosNoEncontrados.push({
    motivo: "no_encontrado",                         // NEW
    sucursal: sucursalDoc || "SIN_SUCURSAL",         // NEW
    encontradoEnBD: false,                           // NEW
    estado: "no_encontrado",                         // NEW
    codigoSAP: null,                                 // NEW

    material:    objectData.Material,
    descripcion: objectData.Description,
    cantidad:    cantidadPDF || 0,
    totalLineaUsd: (totalLinea != null) ? Number(totalLinea) : 0,
    precioUnitarioUsd: (unitarioDerivado != null) ? Number(unitarioDerivado) : null,
    codigo: "No encontrado"
  });
}

        }
      }

      extractedData[key] = lista;
    }
  }

  console.log(productosNoEncontrados)

  return { extractedData, productosNoEncontrados };
}

module.exports = { extractFields };
