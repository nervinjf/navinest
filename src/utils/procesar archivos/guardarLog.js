const fs = require("fs");
const path = require("path");

/**
 * Guarda un mensaje de log en un archivo con fecha y hora
 * @param {string} mensaje - Texto del log
 * @param {string} tipo - Tipo del log (info, error, warning, etc)
 */
function guardarLog(mensaje, tipo = "info") {
  const fecha = new Date().toISOString();
  const logLine = `[${fecha}] [${tipo.toUpperCase()}] ${mensaje}\n`;

  const logDir = path.join(__dirname, "..", "logs");
  const logFile = path.join(logDir, "app.log");

  // Crear carpeta logs si no existe
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }

  fs.appendFileSync(logFile, logLine, "utf8");

  // También puedes mostrarlo en consola si quieres
  if (tipo === "error") {
    console.error(logLine);
  } else {
    console.log(logLine);
  }
}

module.exports = { guardarLog };
