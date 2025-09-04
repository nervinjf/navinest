const { Router } = require("express");
const { list, create, update, remove, setActive, check } = require("../controllers");
const authVerification = require("../middlewares/auth.middleware");


const router = Router();

// LISTAR (GET /allowlist?page=&limit=&q=&active=)
router.get("/nebconnection/nestle/allowlist", /* requireAuth, */ list);

// CREAR (POST /allowlist)
router.post("/nebconnection/nestle/allowlist", /* requireAuth, requireAdmin, */ create);

// ACTUALIZAR (PUT /allowlist/:id)
router.put("/nebconnection/nestle/allowlist/:id", /* requireAuth, requireAdmin, */ update);

// ACTIVAR/DESACTIVAR (PATCH /allowlist/:id/active)
router.patch("/nebconnection/nestle/allowlist/:id/active", /* requireAuth, requireAdmin, */ setActive);

// ELIMINAR (DELETE /allowlist/:id)
router.delete("/nebconnection/nestle/allowlist/:id", /* requireAuth, requireAdmin, */ remove);

// CHEQUEAR REMITENTE (GET /allowlist/check?email=foo@bar.com)
router.get("/nebconnection/nestle/allowlist/check", /* requireAuth, */ check);



module.exports = router;