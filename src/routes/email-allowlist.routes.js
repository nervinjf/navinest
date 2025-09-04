const express = require("express");
const router = express.Router();
const controller = require("../controllers/email-allowlist.controllers");

// LISTAR (GET /allowlist?page=&limit=&q=&active=)
router.get("/nebconnection/nestle/allowlist", controller.list);

// CREAR (POST /allowlist)
router.post("/nebconnection/nestle/allowlist", controller.create);

// ACTUALIZAR (PUT /allowlist/:id)
router.put("/nebconnection/nestle/allowlist/:id", controller.update);

// ACTIVAR/DESACTIVAR (PATCH /allowlist/:id/active)
router.patch("/nebconnection/nestle/allowlist/:id/active", controller.setActive);

// ELIMINAR (DELETE /allowlist/:id)
router.delete("/nebconnection/nestle/allowlist/:id", controller.remove);

// CHEQUEAR REMITENTE (GET /allowlist/check?email=foo@bar.com)
router.get("/nebconnection/nestle/allowlist/check", controller.check);

module.exports = router;
