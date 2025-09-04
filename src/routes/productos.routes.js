const { Router } = require("express");
const { CreateBulk, editBulk, ListProducts, createProduct, updateProduct, searchProduct} = require("../controllers");
const authVerification = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");


const router = Router();

router.get("/nebconnection/nestle/productos",  ListProducts);
router.get("/nebconnection/nestle/productos/select",  searchProduct);
router.post('/nebconnection/nestle/productos/bulk', upload.single("file"), CreateBulk);
router.post('/nebconnection/nestle/productos', createProduct);
router.put("/nebconnection/nestle/productos/bulk", upload.single("file"), editBulk);
router.put("/nebconnection/nestle/productos/:id", updateProduct);

module.exports = router;