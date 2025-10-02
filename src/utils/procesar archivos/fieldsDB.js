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
//     console.log(codigo, sucu)
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
//     console.log(producto)
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
//        const totalLinea = pickLineTotalFromItemObject(objectData);
// const unitarioDerivado = (totalLinea != null && cantidadPDF > 0)
//   ? Number(totalLinea) / Number(cantidadPDF)
//   : null;

// const esActivo = (pc) => {
//   const estadoPC   = (pc?.estado || "").trim().toLowerCase();
//   if (estadoPC === "activo") return true;
//   const estadoProd = (pc?.producto?.estado_vigente || "").trim().toLowerCase();
//   return estadoProd === "activo";
// };

//           const estadoTexto = (pc) => pc?.estado || pc?.producto?.estado_vigente || "inactivo";

//          if (vinculo && esActivo(vinculo)) {
//   // === ENCONTRADO Y ACTIVO (igual que antes) ===
//   let cantidadConv = cantidadPDF;
//   if (vinculo.cliente?.requiere_conversion) {
//     const keyConv = vinculo.cliente.conversion;
//     const factor  = vinculo.producto.get(keyConv);
//     if (factor) cantidadConv = cantidadPDF / Number(factor);
//   }

//   objectData.Material        = vinculo.producto.codigoSAP;
//   objectData.NumeroFactura   = fields["N Factura"]?.valueString || "SIN_FACTURA";
//   objectData.codigoCliente   = vinculo.cliente?.sucursales?.[0]?.codigo || objectData.codigoCliente;

//   const salesOrg = vinculo?.producto?.SalesOrg || "";
//   const mapping = { "AlimentosyBebidas": "- A&B", "Purina": "- NPP", "Confites": "- C", "Professional": "- Prof" };
//   for (const k of Object.keys(mapping)) {
//     if (salesOrg.includes(k)) {
//       objectData.cust = objectData.NumeroFactura + " " + mapping[k];
//       break;
//     }
//   }
//   objectData.sales = vinculo.producto.SalesOrg;

//   objectData.Cantidad          = cantidadConv;
//   objectData.TotalLineaUsd     = (totalLinea != null) ? Number(totalLinea) : null;
//   objectData.PrecioUnitarioUsd = (unitarioDerivado != null) ? Number(unitarioDerivado) : null;

//   lista.push(objectData);

// } else if (vinculo && !esActivo(vinculo)) {
//   // === NEW: ENCONTRADO PERO INACTIVO ===
//   productosNoEncontrados.push({
//     motivo: "inactivo",                              // NEW
//     sucursal: sucursalDoc || "SIN_SUCURSAL",         // NEW
//     encontradoEnBD: true,                            // NEW
//     estado: estadoTexto(vinculo),                    // NEW (o usa vinculo?.estado || vinculo?.producto?.estado_vigente)
//     codigoSAP: vinculo?.producto?.codigoSAP || null, // NEW ← lo que pediste
//     codigoClienteSugerido: vinculo?.codigoCliente || null, // NEW (opcional)

//     // datos del PDF para trazabilidad
//     materialOriginal: objectData.Material,           // NEW
//     descripcion: objectData.Description,             // NEW
//     cantidad: cantidadPDF || 0,                      // NEW
//     totalLineaUsd: (totalLinea != null) ? Number(totalLinea) : 0,         // NEW
//     precioUnitarioUsd: (unitarioDerivado != null) ? Number(unitarioDerivado) : null, // NEW
//   });

// } else if (
//   objectData.Material &&
//   objectData.Description &&
//   objectData.Material.toUpperCase() !== "CODIGO" &&
//   objectData.Material.toUpperCase() !== "CÓDIGO PRODUCTO"
// ) {
//   // === NO ENCONTRADO EN BD ===
//   productosNoEncontrados.push({
//     motivo: "no_encontrado",                         // NEW
//     sucursal: sucursalDoc || "SIN_SUCURSAL",         // NEW
//     encontradoEnBD: false,                           // NEW
//     estado: "no_encontrado",                         // NEW
//     codigoSAP: null,                                 // NEW

//     material:    objectData.Material,
//     descripcion: objectData.Description,
//     cantidad:    cantidadPDF || 0,
//     totalLineaUsd: (totalLinea != null) ? Number(totalLinea) : 0,
//     precioUnitarioUsd: (unitarioDerivado != null) ? Number(unitarioDerivado) : null,
//     codigo: "No encontrado"
//   });
// }

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

// === Fuzzy helpers (Jaro–Winkler) ===
const SUCURSAL_FUZZY_THRESHOLD = 0.80;

function jaroWinkler(a = "", b = "") {
  a = String(a); b = String(b);
  if (!a && !b) return 1;
  if (!a || !b) return 0;

  const md = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const aM = new Array(a.length).fill(false);
  const bM = new Array(b.length).fill(false);

  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - md);
    const end   = Math.min(i + md + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bM[j] || a[i] !== b[j]) continue;
      aM[i] = bM[j] = true;
      m++;
      break;
    }
  }
  if (m === 0) return 0;

  let t = 0, k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aM[i]) continue;
    while (!bM[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t /= 2;

  const jaro = (m / a.length + m / b.length + (m - t) / m) / 3;

  let l = 0;
  while (l < Math.min(4, a.length, b.length) && a[l] === b[l]) l++;
  const p = 0.1;
  return jaro + l * p * (1 - jaro);
}

function normSucursal(s = "") {
  return String(s)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


const SKU_FUZZY_THRESHOLD = 0.90;

function normSku(s = "") {
  return String(s)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")  // deja sólo alfanuméricos
    .replace(/^0+/, "");        // quita ceros a la izquierda
}


function skuSimilarity(a = "", b = "") {
  const A = normSku(a);
  const B = normSku(b);
  if (!A && !B) return 1;
  if (!A || !B) return 0;

  // Si son idénticos tras normalizar → 1.0
  if (A === B) return 1;

  // Heurística de sufijo (para ceros a la izquierda)
  if (A.endsWith(B) || B.endsWith(A)) {
    // “123456789” vs “00123456789” entra aquí; usamos JW para el % visible
    return jaroWinkler(A, B);
  }

  // Fuzzy general
  return jaroWinkler(A, B);
}

// Pesos para ranking combinado (SKU + Sucursal)
const WEIGHT_SKU = 0.7;   // peso del match por SKU
const WEIGHT_SUC = 0.3;   // peso del match por Sucursal cuando sucuRaw venga

function sucursalScore(sucursales = [], sucuRaw = "") {
  if (!sucuRaw) return { score: 0, best: null }; // sin sucursal → no puntúa
  const target = normSucursal(sucuRaw);
  let best = null, bestScore = 0;

  for (const s of (sucursales || [])) {
    const cand1 = normSucursal(s?.codigo || "");
    const cand2 = normSucursal(s?.sucursal || "");

    // pequeño boost si hay LIKE directo
    const likeBoost = (
      (s?.codigo || "").toLowerCase().includes(sucuRaw.toLowerCase()) ||
      (s?.sucursal || "").toLowerCase().includes(sucuRaw.toLowerCase())
    ) ? 0.1 : 0;

    const score = Math.max(
      jaroWinkler(target, cand1),
      jaroWinkler(target, cand2)
    ) + likeBoost;

    if (score > bestScore) { best = s; bestScore = score; }
  }
  return { score: Math.min(1, bestScore), best };
}



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
  const candidates = [
    obj["Neto Factur"], obj["Neto Factura"], obj.Neto, obj.Importe, obj.ImporteNeto, obj.Total, obj.SubTotal
  ];
  for (const c of candidates) {
    const m = toMoneyMaybe(c);
    if (m != null) return m;
  }
  return null;
}

async function findProductoPorCodigoConFuzzy(codigoInput, sucuRaw) {
  const tail = String(codigoInput || "").slice(-6);

  const candidatos = await ProductosClientes.findAll({
    where: {
      [Op.or]: [
        { codigoCliente: { [Op.like]: `%${codigoInput}%` } },
        { codigoCliente: { [Op.like]: `%${tail}%` } }
      ]
    },
    include: [
      { model: Productos, as: "producto" },
      {
        model: Clientes,
        as: "cliente",
        include: [{ model: Sucursales, as: "sucursales", required: false }]
      }
    ],
    limit: 200
  });

  if (!candidatos.length) return null;

  let best = null;
  let bestTotal = 0;
  let bestSkuScore = 0;
  let bestSucScore = 0;
  let bestSucElegida = null;

  for (const c of candidatos) {
    const skuScore = skuSimilarity(c.codigoCliente, codigoInput); // 0..1

    let sucScore = 0, sucElegida = null;
    if (sucuRaw) {
      const { score, best } = sucursalScore(c?.cliente?.sucursales || [], sucuRaw);
      sucScore = score;
      sucElegida = best;
    }

    const total = sucuRaw
      ? (WEIGHT_SKU * skuScore) + (WEIGHT_SUC * sucScore)
      : skuScore;

    if (total > bestTotal) {
      best = c;
      bestTotal = total;
      bestSkuScore = skuScore;
      bestSucScore = sucScore;
      bestSucElegida = sucElegida;
    }
  }

  if (!best) return null;

  // Valida umbral mínimo de SKU
  if (bestSkuScore < SKU_FUZZY_THRESHOLD) return null;

  if (!sucuRaw) {
    return { match: best, score: bestSkuScore, via: "sku_fuzzy+no_sucursal_pdf" };
  }

  // con sucursal: ¿superó umbral de sucursal?
  if (bestSucScore >= SUCURSAL_FUZZY_THRESHOLD) {
    return {
      match: best,
      score: bestSkuScore,
      sucursalElegida: bestSucElegida,
      sucursalScore: Number(bestSucScore.toFixed(4)),
      via: "sku_fuzzy+succ_fuzzy"
    };
  }

  // No alcanzó el umbral de sucursal (pero SKU sí)
  return {
    base: best,
    best: bestSucElegida,
    score: Number(bestSucScore.toFixed(4)),
    via: "sku_fuzzy+succ_none",
    tipo: "sin_sucursal"
  };
}


/** Busca vínculo cliente-producto + joins habituales */
async function obtenerCodigoDesdeDB(codigo, sucuRaw) {
  try {
    const sucu = (sucuRaw || "").trim();

    // Finder ya rankea por SKU+Sucursal si sucu existe
    const res = await findProductoPorCodigoConFuzzy(codigo, sucu);
    if (!res) return null;

    if (!sucu) {
      // no hay sucursal en PDF
      return { tipo: "ok", match: res.match, via: res.via || "sku_fuzzy+no_sucursal_pdf" };
    }

    if (res.tipo === "sin_sucursal") {
      // SKU ok, pero sucursal < threshold
      return res; // { tipo:"sin_sucursal", base, best, score, via }
    }

    // Hay sucursal y superó el umbral
    return {
      tipo: "ok_fuzzy",
      match: res.match,
      sucursalElegida: res.sucursalElegida || null,
      score: res.sucursalScore ?? null,
      via: res.via || "sku_fuzzy+succ_fuzzy"
    };

  } catch (e) {
    console.error(e);
    return null;
  }
}



function aplicarConversionYAdvertir({
  cantidadPDF,
  vinculo,
  objectData,
  sucursalDoc,
  productosNoEncontrados,
  fields
}) {
  let cantidadConv = cantidadPDF;
  let huboAjuste = false;
  let skipLinea = false;

  try {
    if (vinculo?.cliente?.requiere_conversion) {
      const keyConv = vinculo.cliente.conversion;         // ej. "factor_caja"
      const factor  = vinculo.producto?.get?.(keyConv);

      if (factor && Number(factor) > 0) {
        const cruda = Number(cantidadPDF) / Number(factor);

        if (Number.isFinite(cruda)) {
          // 🚫 Si la conversión es < 1, descartar la línea (no podemos procesar 0)
          if (cruda < 1) {
            const entera = 0;
            skipLinea = true;
            huboAjuste = true;

            productosNoEncontrados.push({
              motivo: "conversion_menor_uno",
              status: "descartado_por_conversion",
              sucursal: sucursalDoc || "SIN_SUCURSAL",
              encontradoEnBD: true,
              codigoSAP: vinculo?.producto?.codigoSAP || null,
              codigoClienteSugerido: vinculo?.codigoCliente || null,
              numeroFactura: fields["N Factura"]?.valueString || "SIN_FACTURA",

              materialOriginal: objectData.Material,
              descripcion: objectData.Description,
              cantidadPDF: Number(cantidadPDF),
              factorUsado: Number(factor),
              cantidadConvertidaOriginal: Number(cruda),
              cantidadConvertidaEntera: entera
            });

            return { cantidadConv: entera, huboAjuste, skipLinea };
          }

          // ⚠️ Si es decimal ≥ 1 → redondeo hacia abajo y se reporta
          if (!Number.isInteger(cruda)) {
            const entera = Math.trunc(cruda);
            cantidadConv = entera;
            huboAjuste = true;

            productosNoEncontrados.push({
              motivo: "producto_mal_convertido",
              status: "ajustado_por_conversion",
              sucursal: sucursalDoc || "SIN_SUCURSAL",
              encontradoEnBD: true,
              codigoSAP: vinculo?.producto?.codigoSAP || null,
              codigoClienteSugerido: vinculo?.codigoCliente || null,
              numeroFactura: fields["N Factura"]?.valueString || "SIN_FACTURA",

              materialOriginal: objectData.Material,
              descripcion: objectData.Description,
              cantidadPDF: Number(cantidadPDF),
              factorUsado: Number(factor),
              cantidadConvertidaOriginal: Number(cruda),
              cantidadConvertidaEntera: Number(entera),
            });
          } else {
            // Entero exacto ≥ 1
            cantidadConv = cruda;
          }
        }
      }
    }
  } catch (_) { /* noop */ }

  return { cantidadConv, huboAjuste, skipLinea };
}


/** === FUNCIÓN PRINCIPAL === */
async function extractFields(fields) {
  const extractedData = {};
  const productosNoEncontrados = [];
  const codigosInactivos = ["Inactivar", "Inactivo", "Inactivo In & Out"];
  const huboSinSucursal = { flag: false }; // opcional, para marcar a nivel factura
  const huboAjusteConv  = { flag: false };  

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
          const cantidadPDFRaw = toNumberStrict(objectData.Cantidad);
          const cantidadPDF = Number.isFinite(cantidadPDFRaw) && cantidadPDFRaw > 0 ? cantidadPDFRaw : 0;


          // 4) Intentar mapear a SKU interno usando sucursal del documento
          const sucursalDoc = fields["Sucursal"]?.valueString;
          const resVinculo = await obtenerCodigoDesdeDB(objectData.Material, sucursalDoc);

          // 5) TOTAL DE LÍNEA desde el PDF (Neto Factur)
          const totalLinea = pickLineTotalFromItemObject(objectData);
          const unitarioDerivado = (totalLinea != null && cantidadPDF > 0)
            ? Number(totalLinea) / Number(cantidadPDF)
            : null;

          const esActivo = (pc) => {
            const estadoPC = (pc?.estado || "").trim().toLowerCase();
            if (estadoPC === "activo") return true;
            const estadoProd = (pc?.producto?.estado_vigente || "").trim().toLowerCase();
            return estadoProd === "activo";
          };
          const estadoTexto = (pc) => pc?.estado || pc?.producto?.estado_vigente || "inactivo";

          // === Casuística ===
          if (resVinculo?.tipo === "ok" && esActivo(resVinculo.match)) {
            // === ENCONTRADO POR LIKE CON SUCURSAL ===
            const vinculo = resVinculo.match;

             // Conversión + advertencia si decimal (redondeo hacia abajo)
            let { cantidadConv, huboAjuste, skipLinea  } = aplicarConversionYAdvertir({
              cantidadPDF,
              vinculo,
              objectData,
              sucursalDoc,
              productosNoEncontrados,
              fields
            });
            if (huboAjuste) huboAjusteConv.flag = true;

            // 🚫 Si la conversión quedó < 1, NO agregues la línea
if (skipLinea || cantidadConv < 1) {
  continue;
}

            // Campos
            objectData.Material = vinculo.producto.codigoSAP;
            objectData.NumeroFactura = fields["N Factura"]?.valueString || "SIN_FACTURA";
            objectData.codigoCliente = vinculo.cliente?.sucursales?.[0]?.codigo || objectData.codigoCliente;

            const salesOrg = vinculo?.producto?.SalesOrg || "";
            const mapping = { "AlimentosyBebidas": "- A&B", "Purina": "- NPP", "Confites": "- C", "Professional": "- Prof" };
            for (const k of Object.keys(mapping)) {
              if (salesOrg.includes(k)) {
                objectData.cust = objectData.NumeroFactura + " " + mapping[k];
                break;
              }
            }
            objectData.sales = vinculo.producto.SalesOrg;

            objectData.Cantidad = cantidadConv;
            objectData.TotalLineaUsd = (totalLinea != null) ? Number(totalLinea) : null;
            objectData.PrecioUnitarioUsd = (unitarioDerivado != null) ? Number(unitarioDerivado) : null;

            // opcional: auditar vía de match
            objectData._matchSucursal = { via: resVinculo.via || "like", score: null, codigo: objectData.codigoCliente, nombre: null };

            lista.push(objectData);

          } else if (resVinculo?.tipo === "ok_fuzzy" && esActivo(resVinculo.match)) {
            // === ENCONTRADO POR FUZZY DE SUCURSAL (≥ umbral) ===
            const vinculo = resVinculo.match;
            const sucEleg = resVinculo.sucursalElegida;

           let { cantidadConv, huboAjuste, skipLinea  } = aplicarConversionYAdvertir({
              cantidadPDF,
              vinculo,
              objectData,
              sucursalDoc,
              productosNoEncontrados,
              fields
            });
            if (huboAjuste) huboAjusteConv.flag = true;

            // 🚫 Si la conversión quedó < 1, NO agregues la línea
if (skipLinea || cantidadConv < 1) {
  continue;
}

            // Campos
            objectData.Material = vinculo.producto.codigoSAP;
            objectData.NumeroFactura = fields["N Factura"]?.valueString || "SIN_FACTURA";
            objectData.codigoCliente = sucEleg?.codigo || objectData.codigoCliente; // <-- usar la sucursal fuzzy elegida

            const salesOrg = vinculo?.producto?.SalesOrg || "";
            const mapping = { "AlimentosyBebidas": "- A&B", "Purina": "- NPP", "Confites": "- C", "Professional": "- Prof" };
            for (const k of Object.keys(mapping)) {
              if (salesOrg.includes(k)) {
                objectData.cust = objectData.NumeroFactura + " " + mapping[k];
                break;
              }
            }
            objectData.sales = vinculo.producto.SalesOrg;

            objectData.Cantidad = cantidadConv;
            objectData.TotalLineaUsd = (totalLinea != null) ? Number(totalLinea) : null;
            objectData.PrecioUnitarioUsd = (unitarioDerivado != null) ? Number(unitarioDerivado) : null;

            // auditar match fuzzy
            objectData._matchSucursal = {
              via: resVinculo.via || "fuzzy",
              score: Number((resVinculo.score ?? 0).toFixed(4)),
              codigo: sucEleg?.codigo || null,
              nombre: sucEleg?.sucursal || null
            };

            lista.push(objectData);

          } else if (resVinculo?.tipo === "sin_sucursal") {
            // === ENCONTRADO PERO NINGUNA SUCURSAL ALCANZÓ EL UMBRAL ===
            huboSinSucursal.flag = true; // opcional: marcar estado de factura

            const base = resVinculo.base;
            productosNoEncontrados.push({
              motivo: "sin_sucursal",
              status: "sin sucursal conseguida",
              sucursal: sucursalDoc || "SIN_SUCURSAL",
              encontradoEnBD: true,
              estado: estadoTexto(base),
              codigoSAP: base?.producto?.codigoSAP || null,
              codigoClienteSugerido: base?.codigoCliente || null,
              bestSucursalIntentada: resVinculo?.best ? {
                codigo: resVinculo.best.codigo || null,
                nombre: resVinculo.best.sucursal || null,
                score: Number((resVinculo.score || 0).toFixed(4))
              } : null,

              // datos del PDF
              materialOriginal: objectData.Material,
              descripcion: objectData.Description,
              cantidad: cantidadPDF || 0,
              totalLineaUsd: (totalLinea != null) ? Number(totalLinea) : 0,
              precioUnitarioUsd: (unitarioDerivado != null) ? Number(unitarioDerivado) : null,
            });

          } else if (
            objectData.Material &&
            objectData.Description &&
            objectData.Material.toUpperCase() !== "CODIGO" &&
            objectData.Material.toUpperCase() !== "CÓDIGO PRODUCTO"
          ) {
            // === NO ENCONTRADO EN BD ===
            productosNoEncontrados.push({
              motivo: "no_encontrado",
              status: "no encontrado",
              sucursal: sucursalDoc || "SIN_SUCURSAL",
              encontradoEnBD: false,
              estado: "no_encontrado",
              codigoSAP: null,

              material: objectData.Material,
              descripcion: objectData.Description,
              cantidad: cantidadPDF || 0,
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

  // (Opcional) Marca un estado a nivel de factura si hubo al menos un "sin_sucursal"
 if (huboSinSucursal.flag) extractedData._estatusFactura = "sin sucursal conseguida";
  if (huboAjusteConv.flag)  extractedData._alertasConversion = true;

  console.log(productosNoEncontrados);
  return { extractedData, productosNoEncontrados };
}

module.exports = { extractFields };
