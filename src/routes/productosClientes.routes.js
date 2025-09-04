const { Router } = require("express");
const { CreateBulkPClientes, editBulkPClientes, ListProductsClientes, createProductClientes, updateProductClientes} = require("../controllers");
const authVerification = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");


const router = Router();

router.get("/nebconnection/nestle/productosClientes/cliente/:id",  ListProductsClientes);
router.post('/nebconnection/nestle/productosClientes/bulk/:id', upload.single("file"), CreateBulkPClientes);
router.post('/nebconnection/nestle/productosClientes', createProductClientes);
router.put("/nebconnection/nestle/productosClientes/bulk", upload.single("file"), editBulkPClientes);
router.put("/nebconnection/nestle/productosClientes/:id", updateProductClientes);

module.exports = router;