const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const { Pedidos } = require("../../models");
const { Op } = require("sequelize");

function ejecutarPythonConPromesa(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (err, stdout, stderr) => {
      if (stderr) console.error("⚠️ STDERR:", stderr);
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

// Normaliza rutas tipo \\?\ (Windows long path)
function stripLongPath(p) {
  if (!p) return p;
  return p.startsWith("\\\\?\\") ? p.slice(4) : p;
}

/**
 * @param {string} jsonPath         Ruta del JSON global (resumen_multipedido.json)
 * @param {string} carpetaDestino   Carpeta donde Python generará el .xlsm
 * @param {number[]|number|null} pedidoIds  Uno o varios IDs de Pedidos a actualizar con la ruta global
 * @returns {Promise<string>}       Ruta completa del .xlsm generado por Python (normalizada)
 */
async function generarExcelDesdePython(jsonPath, carpetaDestino, pedidoIds = null) {


  console.log("📦 Generando Excel desde Python con el archivo JSON:", jsonPath);
  try {
    const scriptPath = path.join(__dirname, "python", "generar_excel_con_macro.py");

    const stdout = await ejecutarPythonConPromesa(
      `python "${scriptPath}" "${jsonPath}" "${carpetaDestino}"`
    );

    // 👇 Log completito de lo que imprimió Python (incluye "Filas insertadas")
    console.log("🐍 PYTHON STDOUT >>>\n" + stdout + "\n<<< FIN PYTHON STDOUT");

    // Parseo robusto de la ruta
    const match = stdout.match(/ARCHIVO_GENERADO:(.*\.xlsm)/);
    if (!match) {
      throw new Error("❌ No se pudo detectar el archivo generado desde Python");
    }

    const rutaPython = match[1].trim();
    const rutaNormalizada = stripLongPath(rutaPython);

    // Sanity-check: tamaños
    const srcStat = await fs.promises.stat(rutaNormalizada);
    console.log(`📏 Excel fuente: ${rutaNormalizada} (${srcStat.size} bytes)`);

    // Si el Excel quedó demasiado chico, lo marcamos sospechoso
    if (srcStat.size < 5000) {
      console.warn("⚠️ Excel muy pequeño (posible vacío). Revisa 'Filas insertadas' en el STDOUT.");
    }

    // Actualizar pedidos si corresponde
    const ids = Array.isArray(pedidoIds)
      ? pedidoIds.filter(Boolean)
      : (pedidoIds ? [pedidoIds] : []);

    if (ids.length > 0) {
      const [updated] = await Pedidos.update(
        { archivo_excel: rutaNormalizada, estado: "procesado" },
        { where: { id: { [Op.in]: ids } } }
      );
      console.log(`🗂️ Pedidos actualizados con Excel global: ${updated}`);
    } else {
      console.log("ℹ️ Sin pedidoIds: no se actualizó ningún Pedido con la ruta del Excel global.");
    }

    return rutaNormalizada;
  } catch (error) {
    console.error("❌ Error al generar Excel desde Python:", error.message);
    throw error;
  }
}

module.exports = { generarExcelDesdePython };
