const { Router } = require("express");
const { ListAuditoria } = require("../controllers");
const authVerification = require("../middlewares/auth.middleware");
const upload = require("../middlewares/upload.middleware");


const router = Router();

router.get("/nebconnection/nestle/auditoria",  ListAuditoria);
// router.put("/nebconnection/nestle/clientes/bulk", upload.single("file"), editBulk);


module.exports = router;