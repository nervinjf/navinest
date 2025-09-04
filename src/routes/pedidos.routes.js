const { Router } = require("express");
const { Listpedidos, pedidoById, updatePedidos, deletepedidos, reprocesarPedido } = require("../controllers");
const authVerification = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");


const router = Router();

router.get("/nebconnection/nestle/pedidos",  Listpedidos);
router.get("/nebconnection/nestle/pedidos/:id",  pedidoById);
router.put("/nebconnection/nestle/pedidos/:id", updatePedidos);
router.delete("/nebconnection/nestle/pedidos/:id", deletepedidos);
router.post("/nebconnection/nestle/pedidos/:id/reprocesar", reprocesarPedido);




module.exports = router;