const { Router } = require("express");
const { ListClientes, clienteById, CreateBulkClientes, createCliente, updateCLiente, deleteCLiente } = require("../controllers");
const authVerification = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");


const router = Router();

router.get("/nebconnection/nestle/clientes",  authVerification, ListClientes);
router.get("/nebconnection/nestle/clientes/:id",  authVerification, clienteById);
router.post('/nebconnection/nestle/clientes/bulk', authVerification, upload.single("file"), CreateBulkClientes);
router.post('/nebconnection/nestle/clientes', authVerification, createCliente);
router.put("/nebconnection/nestle/clientes/:id", authVerification, updateCLiente);
router.delete("/nebconnection/nestle/clientes/:id", authVerification, deleteCLiente);
// router.put("/nebconnection/nestle/clientes/bulk", upload.single("file"), editBulk);


module.exports = router;