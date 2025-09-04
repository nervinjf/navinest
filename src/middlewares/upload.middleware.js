const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // crea carpeta uploads si no existe
  },
  filename: (req, file, cb) => {
    cb(null, `productos-bulk-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

module.exports = upload;
