const { Router } = require("express");
const upload = require("../middlewares/upload.middleware");
const {
  CreateBulkBranches,
  EditBulkBranches,
  ListBranches,
  CreateBranch,
  UpdateBranch,
  SearchBranch,
} = require("../controllers/sucursales.controller");

const router = Router();

// Base: /nebconnection/nestle
router.get("/nebconnection/nestle/sucursales", ListBranches);
router.get("/nebconnection/nestle/sucursales/select", SearchBranch);
router.post("/nebconnection/nestle/sucursales/bulk", upload.single("file"), CreateBulkBranches);
router.put("/nebconnection/nestle/sucursales/bulk", upload.single("file"), EditBulkBranches);
router.post("/nebconnection/nestle/sucursales", CreateBranch);
router.put("/nebconnection/nestle/sucursales/:id", UpdateBranch);

module.exports = router;
