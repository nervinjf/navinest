const express = require("express");
const path = require("path");
const router = express.Router();

const {
  getBlobReadSasUrl,
  downloadBlobToBuffer,
} = require("../middlewares/azureBlob");

// Detección básica
const isHttpUrl = (s) => /^https?:\/\//i.test(String(s || ""));
const contentTypes = {
  pdf: "application/pdf",
  excel: "application/vnd.ms-excel",               // .xls
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
};

// Extrae container y blobName desde una URL de Blob
function parseBlobUrl(blobUrl) {
  try {
    const u = new URL(blobUrl);
    // /<container>/<blobName...>
    const parts = u.pathname.replace(/^\/+/, "").split("/");
    const container = parts.shift();
    const blobName = parts.join("/");
    return { container, blobName };
  } catch {
    return null;
  }
}

// Soporta "container/blobName"
function parseContainerSlashBlob(ruta) {
  const s = String(ruta || "").replace(/^\/+/, "");
  const idx = s.indexOf("/");
  if (idx < 0) return null;
  const container = s.slice(0, idx);
  const blobName = s.slice(idx + 1);
  return { container, blobName };
}

router.get("/nebconnection/nestle/descargar", async (req, res) => {
  const { tipo, ruta } = req.query;

  if (!ruta || !tipo) {
    return res.status(400).json({ mensaje: "Faltan parámetros" });
  }

  // Normaliza tipo → content-type/filename
  const t = String(tipo).toLowerCase();
  const ct =
    contentTypes[t] ||
    (t === "excel" ? contentTypes.xlsm : contentTypes.pdf);
  const defaultExt = t === "excel" ? "xlsm" : "pdf";

  // Nombre sugerido de descarga
  const baseNameFromRuta =
    String(ruta).split(/[\\/]/).pop() || `archivo.${defaultExt}`;

  // Caso 1: es una URL de blob → intenta SAS y redirige
  if (isHttpUrl(ruta)) {
    // Intentar parsear container/blob desde la URL
    const parsed = parseBlobUrl(ruta);
    if (!parsed) {
      return res
        .status(400)
        .json({ mensaje: "URL de blob inválida", ruta });
    }

    try {
      // Generar SAS de lectura (descarga directa desde Azure)
      const sasUrl = await getBlobReadSasUrl(parsed.blobName, {
        container: parsed.container,
        expiresInMin: 10,
        attachmentName: baseNameFromRuta, // fuerza descarga con nombre amigable
      });
      return res.redirect(302, sasUrl);
    } catch (e) {
      // Si no podemos generar SAS, hacemos proxy
      try {
        const buffer = await downloadBlobToBuffer({
          blobUrl: ruta,
        });
        res.setHeader("Content-Type", ct);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(baseNameFromRuta)}"`
        );
        return res.send(buffer);
      } catch (err) {
        console.error("Error proxy Blob:", err);
        return res
          .status(404)
          .json({ mensaje: "No se pudo descargar el blob", detalle: err.message });
      }
    }
  }

  // Caso 2: es "container/blobName" → SAS o proxy
  if (ruta.includes("/")) {
    const parsed = parseContainerSlashBlob(ruta);
    if (parsed) {
      try {
        const sasUrl = await getBlobReadSasUrl(parsed.blobName, {
          container: parsed.container,
          expiresInMin: 10,
          attachmentName: baseNameFromRuta,
        });
        return res.redirect(302, sasUrl);
      } catch (e) {
        try {
          const buffer = await downloadBlobToBuffer({
            blobName: parsed.blobName,
            container: parsed.container,
          });
          res.setHeader("Content-Type", ct);
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${encodeURIComponent(baseNameFromRuta)}"`
          );
          return res.send(buffer);
        } catch (err) {
          console.error("Error proxy Blob:", err);
          return res
            .status(404)
            .json({ mensaje: "No se pudo descargar el blob", detalle: err.message });
        }
      }
    }
  }

  // Caso 3: ruta local (legacy)
  try {
    const rutaAbsoluta = path.resolve(ruta);
    return res.download(rutaAbsoluta, baseNameFromRuta, (err) => {
      if (err) {
        console.error("Error al descargar archivo local:", err);
        return res.status(404).json({ mensaje: "Archivo no encontrado" });
      }
    });
  } catch (e) {
    console.error("Error ruta local:", e);
    return res.status(400).json({ mensaje: "Ruta inválida" });
  }
});

module.exports = router;
