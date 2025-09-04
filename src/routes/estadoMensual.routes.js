// routes/estadoMensual.routes.js
const { Router } = require("express");
const { ejecutarSyncEstadoMensual } = require("../controllers/estadoMensual.controllers");
const authVerification = require("../middlewares/auth.middleware");

const router = Router();

// Ejecutar la sincronización (puedes llamarla el 1ero de cada mes o manualmente)
router.post("/nebconnection/nestle/productos/estado-mensual/sync", authVerification, ejecutarSyncEstadoMensual);

module.exports = router;
