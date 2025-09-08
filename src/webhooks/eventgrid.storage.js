// // webhooks/eventgrid.storage.js
// const express = require('express');
// const router = express.Router();

// const path = require('path');
// const fs = require('fs');
// const os = require('os');
// const crypto = require('crypto');

// const { BlobServiceClient } = require('@azure/storage-blob');

// // 👉 ajusta estos imports a tus rutas reales
// const { enviarCorreoConAdjuntoLogged } = require('../services/email-logged.services');
// const { Pedidos } = require('../models');
// const { Op } = require('sequelize');

// /* ==========================
//    Helpers 2 validar
//    ========================== */
// function parseFirstEmail(input) {
//   if (!input) return null;
//   const m = String(input).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
//   return m ? m[0] : null;
// }

// async function getBlobProps(container, blobName) {
//   const svc = getBlobServiceClient();
//   return await svc.getContainerClient(container).getBlobClient(blobName).getProperties();
// }

// /* ==========================
//    Helpers
//    ========================== */
// function isAuthorized(req) {
//   const shared = process.env.EG_SHARED_SECRET || 'CAMBIA_ESTE_VALOR';
//   const headerKey = req.get('x-eg-key');
//   const queryKey = req.query.key;
//   return headerKey === shared || queryKey === shared;
// }

// function getConnString() {
//   const c =
//     process.env.AZURE_STORAGE_CONNECTION_STRING ||
//     process.env.AZ_ST_CONN ||
//     process.env.AZ_QUEUE_CONN;
//   if (!c) throw new Error('No hay cadena de conexión de Storage.');
//   return c;
// }

// function getBlobServiceClient() {
//   return BlobServiceClient.fromConnectionString(getConnString());
// }

// async function downloadBlobToFile(container, blobName, destFile) {
//   const svc = getBlobServiceClient();
//   const containerClient = svc.getContainerClient(container);
//   const blobClient = containerClient.getBlobClient(blobName);

//   await fs.promises.mkdir(path.dirname(destFile), { recursive: true });

//   const response = await blobClient.download();
//   if (!response.readableStreamBody) {
//     throw new Error('No se pudo obtener el stream del blob.');
//   }

//   await new Promise((resolve, reject) => {
//     const w = fs.createWriteStream(destFile);
//     response.readableStreamBody
//       .pipe(w)
//       .on('finish', resolve)
//       .on('error', reject);
//   });

//   return destFile;
// }

// function extractPedidoId(blobName) {
//   const m = String(blobName).match(/E2O[-_ ]?TA[-_ ]?(\d+)\.xlsm$/i);
//   return m ? Number(m[1]) : null;
// }

// /* ==========================
//    Webhook Event Grid
//    ========================== */
// router.post(
//   '/eventgrid/storage-excel',
//   express.json({ type: '*/*' }),
//   async (req, res) => {
//     try {
//       if (!isAuthorized(req)) return res.status(401).send('unauthorized');

//       const events = Array.isArray(req.body) ? req.body : [req.body];

//       for (const evt of events) {
//         if (evt.eventType === 'Microsoft.EventGrid.SubscriptionValidationEvent') {
//           const validationCode = evt?.data?.validationCode;
//           return res.json({ validationResponse: validationCode });
//         }

//         if (evt.eventType !== 'Microsoft.Storage.BlobCreated') continue;

//         const subject = evt.subject || '';
//         const urlFromEvent = evt.data?.url || '';

//         const m = subject.match(/^\/blobServices\/default\/containers\/([^/]+)\/blobs\/(.+)$/i);
//         const container = m?.[1] || null;
//         const blobName = m?.[2] || null;

//         if (!container || !blobName) continue;

//         const pedidoId = extractPedidoId(blobName);

//         console.log('BlobCreated recibido:', { container, blobName, url: urlFromEvent, pedidoId });

//         // 👉 Siempre lo descargamos como "E2O TA.xlsm"
//         const destFile = path.join(os.tmpdir(), `E2O TA.xlsm`);
//         await downloadBlobToFile(container, blobName, destFile);

//         const stat = await fs.promises.stat(destFile);
//         console.log(`📥 Descargado ${blobName} (${stat.size} bytes) → ${destFile}`);

//         // Actualiza DB
//         if (pedidoId) {
//           await Pedidos.update(
//             { archivo_excel: urlFromEvent, estado_excel: 'listo' },
//             { where: { id: { [Op.in]: [pedidoId] } } }
//           );
//         }

//         // Enviar correo adjuntando el Excel con nombre fijo
         
//         const destinatario =
//           process.env.EVENTGRID_ATTACH_TO ||
//           process.env.DEFAULT_REPORT_EMAIL ||
//           'nflores@neb.com.ve';

//         await enviarCorreoConAdjuntoLogged(destFile, [], {
//           empresa: 'MÚLTIPLES',
//           nroFactura: pedidoId ? `Pedido ${pedidoId}` : 'GLOBAL',
//           destinatario,
//           sourceId: evt.id,
//           idempotencyKey: `eg-attach:${evt.id}`,
//         });

//         try { await fs.promises.unlink(destFile); } catch {}
//       }

//       return res.status(200).end();
//     } catch (err) {
//       console.error('Webhook EventGrid error:', err);
//       return res.status(500).send('failed');
//     }
//   }
// );

// module.exports = router;



// webhooks/eventgrid.storage.js
const express = require('express');
const router = express.Router();

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const { BlobServiceClient } = require('@azure/storage-blob');

// 👉 ajusta estos imports a tus rutas reales
const { enviarCorreoConAdjuntoLogged } = require('../services/email-logged.services');
const { Pedidos } = require('../models');
const { Op } = require('sequelize');

/* ==========================
   Helpers (validados)
   ========================== */
function parseFirstEmail(input) {
  if (!input) return null;
  const m = String(input).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
}

function getConnString() {
  const c =
    process.env.AZURE_STORAGE_CONNECTION_STRING ||
    process.env.AZ_ST_CONN ||
    process.env.AZ_QUEUE_CONN;
  if (!c) throw new Error('No hay cadena de conexión de Storage.');
  return c;
}

function getBlobServiceClient() {
  return BlobServiceClient.fromConnectionString(getConnString());
}

async function getBlobProps(container, blobName) {
  const svc = getBlobServiceClient();
  return await svc.getContainerClient(container).getBlobClient(blobName).getProperties();
}

function isAuthorized(req) {
  const shared = process.env.EG_SHARED_SECRET || 'CAMBIA_ESTE_VALOR';
  const headerKey = req.get('x-eg-key');
  const queryKey = req.query.key;
  return headerKey === shared || queryKey === shared;
}

async function downloadBlobToFile(container, blobName, destFile) {
  const svc = getBlobServiceClient();
  const containerClient = svc.getContainerClient(container);
  const blobClient = containerClient.getBlobClient(blobName);

  await fs.promises.mkdir(path.dirname(destFile), { recursive: true });

  const response = await blobClient.download();
  if (!response.readableStreamBody) {
    throw new Error('No se pudo obtener el stream del blob.');
  }

  await new Promise((resolve, reject) => {
    const w = fs.createWriteStream(destFile);
    response.readableStreamBody
      .pipe(w)
      .on('finish', resolve)
      .on('error', reject);
  });

  return destFile;
}

function extractPedidoId(blobName) {
  // E2O TA-<id>.xlsm | E2O_TA<id>.xlsm | E2O TA <id>.xlsm
  const m = String(blobName).match(/E2O[-_ ]?TA[-_ ]?(\d+)\.xlsm$/i);
  return m ? Number(m[1]) : null;
}

/* ==========================
   Webhook Event Grid
   ========================== */
router.post(
  '/eventgrid/storage-excel',
  express.json({ type: '*/*' }),
  async (req, res) => {
    try {
      if (!isAuthorized(req)) return res.status(401).send('unauthorized');

      const events = Array.isArray(req.body) ? req.body : [req.body];

      // Responder validación si viene
      if (events.length === 1 && events[0]?.eventType === 'Microsoft.EventGrid.SubscriptionValidationEvent') {
        const validationCode = events[0]?.data?.validationCode;
        return res.json({ validationResponse: validationCode });
      }

      for (const evt of events) {
        // ignora eventos que no sean BlobCreated
        if (evt.eventType !== 'Microsoft.Storage.BlobCreated') continue;

        const subject = evt.subject || '';
        const urlFromEvent = evt.data?.url || '';

        const m = subject.match(/^\/blobServices\/default\/containers\/([^/]+)\/blobs\/(.+)$/i);
        const container = m?.[1] || null;
        const blobName = m?.[2] || null;

        if (!container || !blobName) continue;

        const pedidoId = extractPedidoId(blobName);
        console.log('BlobCreated recibido:', { container, blobName, url: urlFromEvent, pedidoId });

        // 1) Leer metadata para el destinatario
        let destinatarioMeta = null;
         let asuntoMeta = null;
        try {
          const props = await getBlobProps(container, blobName);
          const md = props?.metadata || {};
          destinatarioMeta = parseFirstEmail(md.replyto || md.destinatario || md.email);
          asuntoMeta = md.asunto || md.subject || md.titulo || null; // NEW
          console.log('metadata:', md, '→ destinatarioMeta:', destinatarioMeta);
        } catch (e) {
          console.warn('No se pudo leer metadata del blob:', e?.message);
        }

        // 2) Descargar Excel a archivo temporal único
        const base = path.basename(blobName);
        const tmpName = `E2O TA.xlsm`;
        const destFile = path.join(os.tmpdir(), tmpName);
        await downloadBlobToFile(container, blobName, destFile);

        const stat = await fs.promises.stat(destFile);
        console.log(`📥 Descargado ${blobName} (${stat.size} bytes) → ${destFile}`);

        // 3) Actualiza DB (marca listo + guarda URL del evento si te sirve)
        try {
          if (pedidoId) {
            await Pedidos.update(
              { archivo_excel: urlFromEvent, estado_excel: 'listo' },
              { where: { id: { [Op.in]: [pedidoId] } } }
            );
          }
        } catch (e) {
          console.warn('No se pudo actualizar Pedidos:', e?.message);
        }

        // 4) Resolver destinatario con fallbacks
        const destinatario =
          destinatarioMeta ||
          process.env.EVENTGRID_ATTACH_TO ||
          process.env.DEFAULT_REPORT_EMAIL ||
          'nflores@neb.com.ve';

               function normalizeSubject(s, fb = 'Excel generado') {
  return String(s || fb).replace(/\r?\n/g, ' ').trim().slice(0, 200);
}

               const asuntoFinal = normalizeSubject(
  asuntoMeta || (pedidoId ? `Pedido procesado - ${pedidoId}` : 'Excel generado')
);

           

        // 5) Enviar el correo con adjunto
        await enviarCorreoConAdjuntoLogged(destFile, [], {
          empresa: 'MÚLTIPLES',
          nroFactura: pedidoId ? `Pedido ${pedidoId}` : 'GLOBAL',
          destinatario,
         subject: asuntoFinal,  
          sourceId: evt.id,
          idempotencyKey: `eg-attach:${evt.id}`,
        });

        // 6) Limpieza
        try { await fs.promises.unlink(destFile); } catch {}
      }

      return res.status(200).end();
    } catch (err) {
      console.error('Webhook EventGrid error:', err);
      return res.status(500).send('failed');
    }
  }
);

module.exports = router;
