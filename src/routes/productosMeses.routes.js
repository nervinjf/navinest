const { Router } = require("express");
const { crearMesActivo, eliminarMesActivo, listarMesesPorProducto } = require("../controllers/productosMeses.controllers");
const authVerification = require("../middlewares/auth.middleware");

const router = Router();

// Agregar mes activo a producto
router.post("/nebconnection/nestle/productos/:productoId/meses", crearMesActivo);

// Eliminar mes activo
router.delete("/nebconnection/nestle/productos/:productoId/meses/:mes", eliminarMesActivo);

// Listar meses activos para un producto
router.get("/nebconnection/nestle/productos/:productoId/meses", listarMesesPorProducto);

module.exports = router;
