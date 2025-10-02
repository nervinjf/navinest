const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

// ================= Transporter =================
const transporter = nodemailer.createTransport({
  host: "nebconnection.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: true,
  },
});

// ================ Helpers ======================
function ensureEmail(v) {
  if (!v) return process.env.DEFAULT_REPORT_EMAIL || "nflores@neb.com.ve";
  if (typeof v === "string") {
    const m = v.match(/<([^>]+)>/);
    if (m) return m[1].trim();
    if (v.includes("@")) return v.trim();
  }
  if (typeof v === "object" && v?.address) return String(v.address).trim();
  if (Array.isArray(v) && v[0]?.address) return String(v[0].address).trim();
  return process.env.DEFAULT_REPORT_EMAIL || "nflores@neb.com.ve";
}

// tolerante con claves diferentes
const pickMat = (it) => it?.material ?? it?.material ?? it?.materialOriginal ?? it?.SKU ?? "s/d";
const pickDesc = (it) => it?.descripcion ?? it?.descripcion ?? it?.desc ?? "s/d";

/**
 * Normaliza `productosNoEncontrados` en Map<factura, items[]>
 * Soporta:
 *   - [{ factura, faltantes:[{material, descripcion, ...}, ...] }, ...]  (agrupado)
 *   - [{ NumeroFactura, material, descripcion, ... }, ...]                (plano)
 */
function agruparPorFactura(input) {
  const map = new Map();
  if (!Array.isArray(input)) return map;

  // Forma agrupada explícita
  if (input.length && (input[0].factura || input[0].numeroFactura)) {
    for (const g of input) {
      const factura = String(g.factura || g.numeroFactura || "SIN_FACTURA");
      const lista = Array.isArray(g.faltantes) ? g.faltantes : [];
      if (!map.has(factura)) map.set(factura, []);
      map.get(factura).push(...lista);
    }
    return map;
  }

  // Forma plana
  for (const it of input) {
    const factura = String(it?.NumeroFactura || it?.factura || "SIN_FACTURA");
    if (!map.has(factura)) map.set(factura, []);
    map.get(factura).push(it);
  }
  return map;
}

// function buildTextoFaltantes(productosNoEncontrados) {
//   const grupos = agruparPorFactura(productosNoEncontrados);
//   if (grupos.size === 0) {
//     return "✅ Todos los productos fueron encontrados correctamente.";
//   }

//   let txt = "⚠ Productos con problemas (agrupados por pedido):\n";

//   for (const [factura, items] of grupos.entries()) {
//     // toma la sucursal del primer item que la tenga
//     const sucursal = items.find(x => x?.sucursal)?.sucursal || "SIN_SUCURSAL";
//     txt += `\n- Pedido (${factura}) — Sucursal: ${sucursal}\n`;

//     for (const it of items) {
//       const mat  = pickMat(it);
//       const desc = pickDesc(it);

//       // estado por línea
//       let estado = "NO ENCONTRADO";
//       if (it?.motivo === "inactivo") {
//         estado = `INACTIVO${it?.codigoSAP ? ` (SAP: ${it.codigoSAP})` : ""}`;
//       } else if (it?.encontradoEnBD === true && it?.codigoSAP) {
//         estado = `ENCONTRADO (SAP: ${it.codigoSAP})`;
//       }

//       txt += `   - ${mat} — ${desc} — ${estado}\n`;
//     }
//   }

//   return txt.trimEnd();
// }

function buildTextoFaltantes(productosNoEncontrados) {
  const grupos = agruparPorFactura(productosNoEncontrados);
  if (grupos.size === 0) {
    return "✅ Todos los productos fueron encontrados correctamente.";
  }

  const fmt = (v, d = 4) => (
    Number.isFinite(Number(v)) ? Number(v).toFixed(d).replace(/\.?0+$/, "") : "N/D"
  );

  let txt = "⚠ Productos con problemas (agrupados por pedido):\n";

  for (const [factura, items] of grupos.entries()) {
    const sucursal = items.find(x => x?.sucursal)?.sucursal || "SIN_SUCURSAL";

    const tieneSinSucursal = items.some(x => x?.motivo === "sin_sucursal");
    const convAjustadas   = items.filter(x => x?.motivo === "producto_mal_convertido").length;

    const bannerSinSucursal = tieneSinSucursal
      ? "  ⚑ Atención: ninguna sucursal alcanzó el umbral para al menos una línea.\n"
      : "";
    const bannerConv = convAjustadas > 0
      ? `  ⚑ Conversión ajustada en ${convAjustadas} línea(s) por cantidades decimales.\n`
      : "";

    txt += `\n- Pedido (${factura}) — Sucursal (doc): ${sucursal}\n${bannerSinSucursal}${bannerConv}`;

    for (const it of items) {
      const mat  = (typeof pickMat === "function"  ? pickMat(it)  : (it.materialOriginal || it.material || it.codigoSAP || "N/D"));
      const desc = (typeof pickDesc === "function" ? pickDesc(it) : (it.descripcion || "N/D"));

      let estado = "NO ENCONTRADO";

      if (it?.motivo === "inactivo") {
        estado = `INACTIVO${it?.codigoSAP ? ` (SAP: ${it.codigoSAP})` : ""}`;

      } else if (it?.motivo === "sin_sucursal") {
        const best = it?.bestSucursalIntentada;
        const bestInfo = best
          ? ` — mejor intento: ${best.nombre ?? best.codigo ?? "N/D"} (score: ${fmt(best.score, 4)})`
          : "";
        const codSAP = it?.codigoSAP ? ` (SAP: ${it.codigoSAP})` : "";
        estado = `SIN SUCURSAL${codSAP}${bestInfo}`;

      } else if (it?.motivo === "producto_mal_convertido") {
        // 👇 Mensaje específico de conversión decimal
        // Ej: PDF=25 / factor=12 = 2.0833 → 2 (redondeado hacia abajo)
        const detalle =
          `PDF=${fmt(it.cantidadPDF, 4)} / factor=${fmt(it.factorUsado, 4)} = ` +
          `${fmt(it.cantidadConvertidaOriginal, 6)} → ${fmt(it.cantidadConvertidaEntera, 0)} (redondeado)`;
        const codSAP = it?.codigoSAP ? ` (SAP: ${it.codigoSAP})` : "";
        estado = `CONVERSIÓN AJUSTADA${codSAP} — ${detalle}`;

      } else if (it?.encontradoEnBD === true && it?.codigoSAP) {
        estado = `ENCONTRADO (SAP: ${it.codigoSAP})`;
      }

      txt += `  - ${mat} — ${desc} — ${estado}\n`;
    }
  }

  return txt.trimEnd();
}




// ================= Envíos ======================

/**
 * Envía un correo con un archivo adjunto (Excel) y un mensaje.
 * @param {string} filePath - Ruta del archivo adjunto (Excel).
 * @param {Array} productosNoEncontrados - Puede venir en formato plano o agrupado.
 * @param {{ empresa?: string, nroFactura?: string, destinatario?: string, asunto?: string, subject?: string, }} meta
 */
async function enviarCorreoConAdjunto(filePath, productosNoEncontrados = [], meta = {}) {
  const {
    empresa = "Desconocida",
    nroFactura = "N/A",
    destinatario = "nflores@neb.com.ve",
    subject
  } = meta;

  const sanitizeSubject = (s, fb = 'Pedido procesado') =>
    String(s || fb).replace(/\r?\n/g, ' ').trim().slice(0, 200);

  const productosTexto = buildTextoFaltantes(productosNoEncontrados);

  const cuerpoCorreo =
    `En el adjunto encontrarás el archivo Excel con los datos procesados.\n\n` +
    `${productosTexto}`;

  const attachments = [];
  if (typeof filePath === "string" && filePath) {
    attachments.push({ filename: path.basename(filePath), path: filePath });
  }

const TO = ensureEmail("Mirleny.Munoz@ve.nestle.com");
const desti = ensureEmail(destinatario);

let cc;

if (desti.toLowerCase() === "Katherine.Domingos1@ve.nestle.com".toLowerCase()) {
  // Si el destinatario es Katherine → no la repitas en cc
  cc = [
    ensureEmail("Katherine.Domingos1@ve.nestle.com"),
    ensureEmail("nflores@neb.com.ve"),
    ensureEmail("daura.gonzalez1@ve.nestle.com"),
    ensureEmail("andrea.rojas1@ve.nestle.com")
  ];
} else {
  // Si el destinatario es otro → incluye también a Katherine
  cc = [
    desti,
    ensureEmail("Katherine.Domingos1@ve.nestle.com"),
    ensureEmail("nflores@neb.com.ve"),
    ensureEmail("daura.gonzalez1@ve.nestle.com"),
    ensureEmail("andrea.rojas1@ve.nestle.com")
  ];
}

// quitar duplicados por si acaso
cc = Array.from(new Set(cc.map(e => e.toLowerCase())));

  const mailOptions = {
    from: process.env.EMAIL_USER || "dpn.navi@nebconnection.com",
    to: TO,
     // to: ensureEmail("nflores@neb.com.ve"),
     cc,
    subject: `Pedido procesado - ${subject}`,
    text: cuerpoCorreo,
    attachments,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📬 Correo (OK) enviado con éxito.");
  } catch (error) {
    console.error("❌ Error al enviar el correo OK:", error.message);
    throw error;
  }
}

/**
 * Envía correo de error. `adjunto` puede ser Buffer (PDF) o ruta string (PDF) o null.
 * @param {Buffer|string|null} adjuntoPDF
 * @param {Array} productosNoEncontrados - Plano o agrupado por factura.
 * @param {{ empresa?: string, nroFactura?: string, destinatario?: string, asunto?: string, subject?: string, }} meta
 */
async function enviarCorreoDeError(adjuntoPDF, productosNoEncontrados = [], meta = {}) {
  const {
    empresa = "Desconocida",
    nroFactura = "N/A",
    destinatario = "nflores@neb.com.ve",
    subject
  } = meta;

    const sanitizeSubject = (s, fb = "Productos no encontrados - ") =>
    String(s || fb).replace(/\r?\n/g, " ").trim().slice(0, 200);

  const productosTexto = buildTextoFaltantes(productosNoEncontrados);


  let cuerpoCorreo =
    `${productosTexto}\n`;

  const attachments = [];
  if (Buffer.isBuffer(adjuntoPDF)) {
    cuerpoCorreo += `\nSe adjunta el archivo PDF original para revisión manual.\n`;
    attachments.push({
      filename: `pedido_error_${Date.now()}.pdf`,
      content: adjuntoPDF,
      contentType: "application/pdf",
    });
  } else if (typeof adjuntoPDF === "string" && adjuntoPDF) {
    cuerpoCorreo += `\nSe adjunta el archivo PDF original para revisión manual.\n`;
    attachments.push({
      filename: path.basename(adjuntoPDF),
      path: adjuntoPDF,
      contentType: "application/pdf",
    });
  }

  const mailOptions = {
    from: process.env.EMAIL_USER || "dpn.navi@nebconnection.com",
    to: ensureEmail(destinatario),
    cc: [
      ensureEmail("nflores@neb.com.ve")
    ],
    subject: `Productos no encontrados - ${subject}`,
    text: cuerpoCorreo,
    attachments,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("📬 Correo de error enviado con éxito.");
  } catch (error) {
    console.error("❌ Error al enviar correo de error:", error.message);
    throw error;
  }
}

module.exports = { enviarCorreoConAdjunto, enviarCorreoDeError };
