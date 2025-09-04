// routes/archivos.routes.js
const express = require("express");
const router = express.Router();
const { downloadBlobToBuffer } = require("../middlewares/azureBlob");

router.get("/nebconnection/nestle/descargar", async (req, res) => {
  try {
    const { ruta } = req.query;
    if (!ruta) return res.status(400).json({ mensaje: "Falta ruta" });

    // extrae solo el blobName de la URL
    const parts = ruta.split(".net/")[1];
    const [container, ...rest] = parts.split("/");
    const blobName = rest.join("/");

    // lo bajas como buffer
    const buffer = await downloadBlobToBuffer({ blobName, container });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${blobName.split("/").pop()}"`);
    res.send(buffer);
  } catch (err) {
    console.error("❌ Error descargando:", err);
    res.status(500).json({ mensaje: "Error al descargar el archivo" });
  }
});

module.exports = router;

