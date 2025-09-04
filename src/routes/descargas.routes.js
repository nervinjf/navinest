// src/routes/archivos.routes.js
const express = require("express");
const path = require("path");
const router = express.Router();

router.get("/nebconnection/nestle/descargar", (req, res) => {
  const { tipo, ruta } = req.query;

  if (!ruta || !tipo) {
    return res.status(400).json({ mensaje: "Faltan parámetros" });
  }

  const carpetasPermitidas = ["pdf", "excel"];
  if (!carpetasPermitidas.includes(tipo)) {
    return res.status(403).json({ mensaje: "Tipo de archivo no permitido" });
  }

  const rutaAbsoluta = path.resolve(ruta);

  res.download(rutaAbsoluta, (err) => {
    if (err) {
      console.error("Error al descargar archivo:", err);
      return res.status(404).json({ mensaje: "Archivo no encontrado" });
    }
  });
});

module.exports = router; // ✅ asegúrate de exportar el router directamente
