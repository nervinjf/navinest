const { Client } = require("node-poplib-gowhich");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const { procesarArchivo } = require("../utils/procesar archivos/index");
const { procesarPDFsDeCorreoConJob } = require("../services/attachment-processor.services");
const addressParser = require('nodemailer/lib/addressparser');
const { createEmailJobsForAttachments } = require("../services/Report/ingestion-jobs.services");
const { recordInbound, markWhitelist, updateAttachmentStats } = require("../services/Report/email-inbound.services");
const { uploadBufferToBlob } = require("../middlewares/azureBlob");
const AllowListServices = require("../services/email-allowlist.services");



// --- Filtro opcional por remitente (whitelist) ---
const POP_FILTER_ENABLED = String(process.env.POP_FILTER_ENABLED || "false").toLowerCase() === "true";
// CSV de correos permitidos (case-insensitive)
const POP_ALLOWED = new Set(
  String(process.env.POP_ALLOWED_SENDERS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
);
// Si true, borra del servidor los correos NO permitidos; si false, los deja
const POP_DELETE_UNAUTHORIZED = String(process.env.POP_DELETE_UNAUTHORIZED || "true").toLowerCase() === "true";



function parseFirstEmail(input) {
  if (!input) return null;

  // 1) Array de objetos estilo [{ address, name }]
  if (Array.isArray(input)) {
    const first = input[0];
    if (first?.address) return String(first.address).trim();
    if (first?.value?.[0]?.address) return String(first.value[0].address).trim();
    if (first?.text) {
      const m = String(first.text).match(/<([^>]+)>/);
      if (m) return m[1].trim();
      if (String(first.text).includes("@")) return String(first.text).trim();
    }
    return null;
  }

  // 2) Objeto estilo { address, name } o { value:[{address,...}], text:"..." }
  if (typeof input === "object") {
    if (input.address) return String(input.address).trim();
    if (Array.isArray(input.value) && input.value[0]?.address) return String(input.value[0].address).trim();
    if (input.text) {
      const m = String(input.text).match(/<([^>]+)>/);
      if (m) return m[1].trim();
      if (String(input.text).includes("@")) return String(input.text).trim();
    }
    return null;
  }

  // 3) String ("Nombre <correo@dominio>" o "correo@dominio")
  if (typeof input === "string") {
    const m = input.match(/<([^>]+)>/);
    if (m) return m[1].trim();
    if (input.includes("@")) return input.trim();
  }

  return null;
}



// ---------- helpers ----------
function toFilenameSafe(name = "archivo") {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, " ").trim();
}
function isPdf(att) {
  const fname = (att?.filename || att?.name || "").toString().trim();
  const ctype = (att?.contentType || "").toString();
  return /\bapplication\/pdf\b/i.test(ctype) || /\.pdf$/i.test(fname);
}
function extractEmail(from) {
  if (!from) return null;
  if (typeof from === "object") {
    if (from.address) return from.address;
    if (Array.isArray(from.value) && from.value[0]?.address) return from.value[0].address;
    if (from.text) {
      const m = from.text.match(/<([^>]+)>/);
      return m ? m[1] : (from.text.includes("@") ? from.text : null);
    }
  }
  if (typeof from === "string") {
    const m = from.match(/<([^>]+)>/);
    if (m) return m[1];
    if (from.includes("@")) return from.trim();
  }
  return null;
}

// borra y cierra la sesión (DELE -> QUIT) con timeout de cortesía
async function deleAndQuit(client, numero, timeoutMs = 5000) {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      console.warn("⌛ DELE tardó demasiado; enviando QUIT igualmente.");
      done = true;
      try { client.quit(() => resolve()); } catch { resolve(); }
    }, timeoutMs);

    try {
      client.delete(numero, (err) => {
        if (done) return;
        if (err) {
          console.warn("⚠️ DELE devolvió error:", err.message);
        } else {
          console.log(`🗑️ DELE #${numero} aceptado por el servidor.`);
        }
        done = true;
        clearTimeout(t);
        try { client.quit(() => resolve()); } catch { resolve(); }
      });
    } catch (e) {
      clearTimeout(t);
      console.warn("⚠️ Excepción en DELE, enviando QUIT:", e.message);
      try { client.quit(() => resolve()); } catch { resolve(); }
    }
  });
}

// cache para no reprocesar si el servidor no borra
const processedDB = path.join(__dirname, "..", "emails_procesados", "processed.json");
function loadProcessed() {
  try { return new Set(JSON.parse(fs.readFileSync(processedDB, "utf-8"))); } catch { return new Set(); }
}
function saveProcessed(set) {
  fs.mkdirSync(path.dirname(processedDB), { recursive: true });
  fs.writeFileSync(processedDB, JSON.stringify([...set], null, 2));
}
// ----------------------------

// lock para no solapar ejecuciones
let running = false;

function revisarCorreo() {
  if (running) { console.log("⏳ Aún procesando; se salta este ciclo."); return; }
  running = true;

  const client = new Client({
    hostname: "nebconnection.com",
    port: 995,
    tls: true,
    mailparser: true,
    username: process.env.EMAIL_USER_LISTENER,
    password: process.env.EMAIL_PASS_LISTENER,
  });

  const watchdog = setTimeout(() => {
    console.warn("🕒 Watchdog liberando lock por timeout.");
    running = false;
  }, 5 * 60 * 1000); // 5 min

  const release = () => { clearTimeout(watchdog); running = false; };

  client.on("error", (err) => console.error("🔥 Error POP3:", err.message));

  (async () => {
    try {
      // 1) Conectar
      await new Promise((res, rej) => client.connect(e => e ? rej(e) : res()));
      console.log("📡 Conexión POP3 establecida ✅");

      // 2) Contar
      const count = await new Promise((res, rej) => client.count((e, c) => e ? rej(e) : res(c)));
      if (!count || count === 0) {
        console.log("📭 No hay correos para procesar.");
        try { client.quit(); } catch { }
        return;
      }

      console.log(`📨 Correos pendientes: ${count}`);
      const numero = count; // último

      // 3) Recuperar
      const msg = await new Promise((res, rej) => client.retrieve(numero, (e, m) => e ? rej(e) : res(m)));
      if (!msg) {
        console.error("❌ Mensaje vacío.");
        try { client.quit(); } catch { }
        return;
      }

      // ✅ Define SIEMPRE messageId (robusto)
      const messageId =
        (msg.messageId && String(msg.messageId).trim()) ||
        (msg["message-id"] && String(msg["message-id"]).trim()) ||
        (msg.headers?.["message-id"] && String(msg.headers["message-id"]).trim()) ||
        "";

      const asunto = msg.subject || "(Sin asunto)";
      const remitenteEmailPuro =
        (Array.isArray(msg.from) && msg.from[0]?.address) ||
        (typeof msg.from === "object" && msg.from?.address) ||
        parseFirstEmail(msg.from) ||
        extractEmail(msg.from) ||
        process.env.DEFAULT_REPORT_EMAIL ||
        "nflores@neb.com.ve";


      // === Registro de correo entrante (EmailInbound) ===
      const receivedAt = msg.date ? new Date(msg.date) : new Date();
      await recordInbound({
        messageId,
        fromAddr: remitenteEmailPuro,
        toAddr: Array.isArray(msg.to) ? (msg.to[0]?.address || null) : extractEmail(msg.to),
        subject: asunto,
        receivedAt,
      });


      // --- Filtro por remitente (opcional) ---
      // --- Filtro por remitente (opcional) ---
      // if (POP_FILTER_ENABLED) {
      //   const fromLc = String(remitenteEmailPuro || "").toLowerCase();
      //   const allowed = POP_ALLOWED.has(fromLc);

      //   // registra en EmailInbound si pasó whitelist
      //   await markWhitelist(messageId, allowed, allowed ? "allowed" : "blocked");

      //   if (!allowed) {
      //     // guarda stats de adjuntos (0 PDFs procesables)
      //     await updateAttachmentStats(messageId, { total: msg.attachments?.length || 0, pdfs: 0 });

      //     console.warn(`🚫 Remitente NO permitido: ${remitenteEmailPuro}. (Filtro activado)`);
      //     if (POP_DELETE_UNAUTHORIZED) {
      //       console.warn("🗑️ POP_DELETE_UNAUTHORIZED=true -> eliminando correo del servidor.");
      //       await deleAndQuit(client, numero);
      //     } else {
      //       console.warn("↩️ POP_DELETE_UNAUTHORIZED=false -> dejando el correo sin tocar.");
      //       try { client.quit(); } catch { }
      //     }
      //     return; // no seguimos procesando este correo
      //   }
      // } else {
      //   // si el filtro está apagado, lo marcamos como permitido
      //   await markWhitelist(messageId, true, "filter_disabled");
      // }


      // reemplaza TODO el bloque original por este
{
  const fromLc = String(remitenteEmailPuro || "").toLowerCase();

  // 1) Decidir si se aplica filtro y consultar allowlist en DB
  let allowed = true;
  let decision = "filter_disabled";

  if (POP_FILTER_ENABLED) {
    try {
      allowed = await AllowListServices.isSenderAllowed(fromLc);
      decision = allowed ? "allowed" : "blocked";
    } catch (e) {
      // si hay error consultando la DB, por seguridad bloquea o permite (elige la política)
      console.warn("⚠️ Error consultando allowlist:", e?.message || e);
      allowed = false;          // ← política conservadora
      decision = "error_allowlist";
    }
  }

  // 2) Registrar en EmailInbound la decisión de whitelist (como ya hacías)
  await markWhitelist(messageId, allowed, decision);

  // 3) Si NO está permitido, cortar el flujo (conservar tu lógica de borrado/quit)
  if (!allowed) {
    // si quieres, registra stats de adjuntos = 0 PDF procesables
    await updateAttachmentStats(messageId, {
      total: msg.attachments?.length || 0,
      pdfs: 0,
    });

    console.warn(`🚫 Remitente NO permitido: ${remitenteEmailPuro}. (decision=${decision})`);

    if (POP_DELETE_UNAUTHORIZED) {
      console.warn("🗑️ POP_DELETE_UNAUTHORIZED=true -> eliminando correo del servidor.");
      await deleAndQuit(client, numero);
    } else {
      console.warn("↩️ POP_DELETE_UNAUTHORIZED=false -> dejando el correo sin tocar.");
      try { client.quit(); } catch {}
    }
    return; // no seguimos procesando este correo
  }

  // 4) Si está permitido, continúa el flujo normal…
}



      // Evitar reprocesar si quedó zombie en el servidor
      const processed = loadProcessed();
      if (messageId && processed.has(messageId)) {
        console.log("↩️ Correo ya procesado (cache Message-ID). Eliminando del servidor…");
        await deleAndQuit(client, numero);
        return;
      }

      console.log("📎 Adjuntos:");
      for (const a of (msg.attachments || [])) {
        console.log(" -", a.filename || a.name || "(sin nombre)", "|", a.contentType, "| size:", a.content?.length || 0);
      }

      // === Stats de adjuntos a nivel de correo ===
      const totalAdjuntos = msg.attachments?.length || 0;
      const pdfCount = (msg.attachments || []).filter(isPdf).length;
      await updateAttachmentStats(messageId, { total: totalAdjuntos, pdfs: pdfCount });


      // 4) Validación / extracción
      const esValido =
        asunto.includes("Pedido") ||
        asunto.includes("XML") ||
        (msg.attachments || []).some(isPdf);

      if (!esValido || !msg.attachments?.length) {
        console.warn("⚠ Correo no válido o sin adjuntos.");
        const rutaError = path.join(__dirname, "..", "emails_no_procesados");
        fs.mkdirSync(rutaError, { recursive: true });
        fs.writeFileSync(
          path.join(rutaError, `correo_parcial_${Date.now()}.txt`),
          `Asunto: ${asunto}\n\n[Correo no válido o sin adjuntos]`
        );
        // eliminar ya
        await deleAndQuit(client, numero);
        return;
      }

      // const rutaProcesado = path.join(__dirname, "..", "emails_procesados");
      // fs.mkdirSync(rutaProcesado, { recursive: true });

      // Sanear el messageId para usarlo como prefijo del blob
      const safeMsgId = String(messageId || asunto || "sin-id")
        .replace(/[^\w./-]+/g, "_")
        .slice(0, 150);

      // SUBIR A BLOB (y seguir pasando buffer al pipeline)
      const pdfAdjuntos = await Promise.all(
        (msg.attachments || [])
          .filter(a => a?.content && isPdf(a))
          .map(async (a, idx) => {
            const base = (a.filename || a.name || `archivo_${Date.now()}_${idx + 1}`).toString().trim();
            const fname = base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
            const nombre = toFilenameSafe(fname);

            // nombre lógico del blob: <messageId>/<archivo>.pdf
            const blobName = `${safeMsgId}/${nombre}`;

            // sube a Azure Blob
            const info = await uploadBufferToBlob({
              buffer: a.content,
              blobName,
              contentType: "application/pdf",
            });

            // devolvemos buffer (para tu procesado), nombre y metadata del blob
            return {
              buffer: a.content,
              nombre,
              blobName,
              blobUrl: info.url,
              sizeBytes: a.content.length,
              eTag: info.eTag,
            };
          })
      );

      // === Crea 1 job por PDF (estado 'queued') ===
      const jobsCreados = await createEmailJobsForAttachments({
        messageId,
        azureModelId: process.env.MODEL_ID,
        attachments: pdfAdjuntos.map(p => ({
          nombre: p.nombre,
          filePath: p.blobUrl,     // si usas filePath como URL del blob
          // blobName: p.blobName, // si tienes una columna separada
          // fileSizeBytes: p.sizeBytes,
        }))
      });


      if (pdfAdjuntos.length === 0) {
        console.warn("⚠ No hay PDFs adjuntos válidos.");
        await deleAndQuit(client, numero);
        return;
      }

      // 5) ✅ BORRAR DEL SERVIDOR *ANTES* DE PROCESAR (ya tenemos copias locales)
      if (messageId) { processed.add(messageId); saveProcessed(processed); }
      await deleAndQuit(client, numero);

      // 6) Procesar offline CADA PDF con su propio Job de telemetría

      try {
        await procesarPDFsDeCorreoConJob({
          archivos: pdfAdjuntos,               // [{ buffer, nombre }, ...]
          origen: "email",
          sourceId: messageId || asunto,
          azureModelId: process.env.MODEL_ID,
          remitente: remitenteEmailPuro,       // quien recibirá el Excel y/o faltantes
          jobsSeed: jobsCreados.map(j => j.id), // 👈 IDs para actualizar cada job
          reuseGlobalJob: true,
          globalJobId: jobsCreados[0]?.id,
          asunto: asunto,
        });
        console.log(`✅ Job global OK: ${pdfAdjuntos.length} PDF(s) procesado(s)`);
      } catch (e) {
        console.error("❌ Job global falló:", e.message);
        // (ya tienes copias locales de los PDFs; puedes reintentar fuera del listener)
      }


    } catch (e) {
      console.error("❌ Error en revisarCorreo:", e);
      try { client.quit(); } catch { }
    } finally {
      release(); // suelta el lock SIEMPRE
    }
  })();
}

// cron cada 20s
cron.schedule("*/10 * * * * *", () => {
  console.log("⏰ Revisando correos...");
  revisarCorreo();
});

module.exports = revisarCorreo;
