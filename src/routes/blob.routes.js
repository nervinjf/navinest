// routes/blob.routes.js
const router = require("express").Router();
const { getBlobReadSasUrl } = require("../middlewares/azureBlob");

// GET /blob/sas?name=2025/09/archivo.pdf&mins=10&download=Factura.pdf
router.get("/sas", async (req, res, next) => {
  try {
    const { name, mins, download } = req.query;
    if (!name) return res.status(400).json({ message: "Falta 'name' del blob" });

    // Aquí puedes validar que el usuario tenga permiso a ese blob…
    const url = await getBlobReadSasUrl(name, {
      expiresInMin: Number(mins) || 10,
      attachmentName: download || undefined
    });
    res.json({ url, expiresInMin: Number(mins) || 10 });
  } catch (e) { next(e); }
});

module.exports = router;
