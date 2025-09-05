const { Op } = require('sequelize');
const fs = require("fs");
const { Productos, Clientes, Pedidos, DetallePedidos } = require('../models');
const xlsx = require("xlsx");
const { extraerDatosDesdePDF } = require('../utils/procesar archivos/extraerDatos');
const { extractFields } = require('../utils/procesar archivos/fieldsDB');
const { extractFieldsIgnore } = require('../utils/procesar archivos/extractFieldsIgnore');
const { generarExcelDesdePython } = require('../utils/procesar archivos/generarExcelDesdePython');
const path = require('path');
const { enviarCorreoConAdjuntoLogged, enviarCorreoDeErrorLogged } = require("../services/email-logged.services");
const fsPromises = fs.promises;

class PedidosServices {
    static async getById(id) {
        try {
            const result = await Pedidos.findByPk(id, {
                include: [{
                    model: DetallePedidos,
                    as: "detalles",
                    attributes: ["cantidad", "observacionConversion"],
                    include: [{
                        model: Productos,
                        as: "producto",
                        attributes: ["producto", "codigoSAP", "estado"]
                    }]
                }]
            });

            if (!result) {
                throw new Error("Cliente no encontrado");
            }
            return result;
        } catch (error) {
            console.error("❌ Error en editBulk:", error); // LOG AL TERMINAL
            throw error;
        }
    }

static async listPedidos(filtros, page = 1, limit = 20) {
  function sanitizeLike(text = "") {
    // escapa % y _ para evitar wildcards no deseados
    return text.replace(/[%_]/g, "\\$&");
  }
  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function endOfDay(d)   { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

  function buildDateWhere({ fecha, from, to }) {
    const today = new Date();

    if (fecha === "hoy") {
      return { [Op.between]: [startOfDay(today), endOfDay(today)] };
    }
    if (fecha === "mes") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { [Op.gte]: startOfDay(first) };
    }
    if (fecha === "rango" && (from || to)) {
      const ini = from ? startOfDay(new Date(from)) : undefined;
      const fin = to   ? endOfDay(new Date(to))     : undefined;
      if (ini && fin) return { [Op.between]: [ini, fin] };
      if (ini)        return { [Op.gte]: ini };
      if (fin)        return { [Op.lte]: fin };
    }

    // por defecto: última semana (incluye hoy)
    const ini = new Date();
    ini.setDate(ini.getDate() - 6);
    return { [Op.between]: [startOfDay(ini), endOfDay(today)] };
  }

  try {
    const { nombre, status, fecha, from, to, clientesId } = filtros;

    const where = {};
    if (status) where.estado = status;
    if (clientesId) where.clienteId = Number(clientesId);
    where.fecha_pedido = buildDateWhere({ fecha, from, to });

    // LIKE operator por dialecto
    const dialect = Pedidos.sequelize.getDialect();
    const likeOp = dialect === "postgres" ? Op.iLike : Op.like;

    // 🔎 Búsqueda combinada: pedidos.nombre O cliente.nombre
    if (nombre?.trim()) {
      const n = `%${sanitizeLike(nombre.trim())}%`;
      where[Op.or] = [
        { nombre: { [likeOp]: n } }
      ];
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Pedidos.findAndCountAll({
      where,
      include: [
        {
          model: Clientes,
          as: "cliente",
          attributes: ["id", "nombre"],
          required: false, // << importante: no inner join
        },
        {
          model: DetallePedidos,
          as: "detalles",
          attributes: ["productoId"], // si luego quieres items precomputado, lo cambiamos
          required: false,
        },
      ],
      limit,
      offset,
      order: nombre?.trim()
        ? [
            [{ model: Clientes, as: "cliente" }, "nombre", "ASC"],
            ["nombre", "ASC"],
            ["createdAt", "DESC"],
          ]
        : [["createdAt", "DESC"]],
      distinct: true, // para que el count sea real con includes
    });

    // 📋 Empresas únicas (catálogo completo). Si no tienes modelo Empresas, ver alternativa más abajo
    const empresasAll = await Clientes.findAll({
      attributes: ["id", "nombre"],
      order: [["nombre", "ASC"]],
      raw: true,
    });

    return {
      total: count,
      paginas: Math.ceil(count / limit),
      paginaActual: page,
      productos: rows,
      empresas: empresasAll, // ← el front usa esto para el select
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
}

    static async update(data, id, usuarioId) {
        try {
            const result = await Pedidos.update(data, {
                where: {
                    id: id
                },
                individualHooks: true, // ⚠️ obligatorio para hooks por instancia
                usuarioId
            });
            return result;
        } catch (error) {
            throw error;
        }
    }

    static async delete(id, usuarioId) {
        try {
            const pedido = await Pedidos.findByPk(id);
            if (!pedido) {
                throw new Error("Cliente no encontrado o ya eliminado");
            }

            // ✅ Elimina pasando usuarioId para que lo tome el hook
            await pedido.destroy({ usuarioId, individualHooks: true });

            return { message: "Cliente eliminado exitosamente" };
        } catch (error) {
            throw error;
        }
    }

    static async procesarPedidoExistente(id, ignorarFaltantes) {
        try {
            const pedido = await Pedidos.findByPk(id, {
                include: [
                    {
                        model: DetallePedidos,
                        as: 'pedido',
                    }
                ]
            });

            const cliente = await Clientes.findByPk(pedido.clienteId)

            const codigosIgnorados = pedido.pedido?.filter(det => det.observacionConversion && det.observacionConversion.includes("("))
                ?.map(det => {
                    const match = det.observacionConversion.match(/\(([^)]+)\)/);
                    return match ? match[1] : null;
                })
                ?.filter(Boolean); // Elimina nulos


            if (!pedido) {
                throw new Error("Cliente no encontrado o ya eliminado");
            }

            console.log("Buscando archivo");
            const archivo = await fsPromises.readFile(pedido?.archivo_pdf);

            console.log("fin de Busqueda archivo");

            const fields = await extraerDatosDesdePDF(archivo);

            let extractedData, productosNoEncontrados;

            if (ignorarFaltantes === true) {
                ({ extractedData, productosNoEncontrados } = await extractFieldsIgnore(fields, codigosIgnorados));
            } else {
                ({ extractedData, productosNoEncontrados } = await extractFields(fields));
            }

            extractedData["Items Compra"] = extractedData["Items Compra"].map(item => ({
                ...item,
                codigoCliente: cliente.codigo
            }));


            if (
                !extractedData["Items Compra"] ||
                !Array.isArray(extractedData["Items Compra"]) ||
                extractedData["Items Compra"].length === 0
            ) {
                const error = new Error("No se encontraron ítems de compra válidos.");
                error.data = extractedData;
                throw error;
            }

            const clienteNombre = extractedData["Empresa"]?.valueString || "Desconocido";
            const fechaActual = new Date();
            const anio = fechaActual.getFullYear();
            const mes = String(fechaActual.getMonth() + 1).padStart(2, "0");

            const rutaClienteBase = path.join(__dirname, "../uploads/Clientes", clienteNombre, anio.toString(), mes);
            const carpetaExcel = path.join(rutaClienteBase, "excel");



            // Ruta ABSOLUTA al JSON
            const rutaJson = path.join(__dirname, "datos_salida.json");

            // Escribe el archivo
            await fsPromises.writeFile(
                rutaJson,
                JSON.stringify(extractedData, null, 2),
                "utf-8"
            );


            if (productosNoEncontrados.length > 0) {
                await enviarCorreoDeErrorLogged(archivo, productosNoEncontrados, {
                    empresa: extractedData["Empresa"]?.valueString,
                    nroFactura: extractedData["N Factura"]?.valueString,
                    destinatario: extractedData["Correo"]?.valueString || "nflores@neb.com.ve"
                });
            } else {
                // console.log("✅ Todos los productos encontrados, generando Excel...");
                const excelPath = await generarExcelDesdePython(rutaJson, carpetaExcel, id);

                const rutaExcelParaCorreo = path.join(carpetaExcel, "E2O TA.xlsm");
                await fs.promises.copyFile(excelPath, rutaExcelParaCorreo);


                await enviarCorreoConAdjuntoLogged(rutaExcelParaCorreo, [], {
                    empresa: extractedData["Empresa"]?.valueString,
                    nroFactura: extractedData["N Factura"]?.valueString
                });

                await fs.promises.unlink(rutaExcelParaCorreo);
            }

            return {
                mensaje: "✅ Excel generado y enviado por correo correctamente.",
                productosNoEncontrados,
                ...extractedData,
            };


        } catch (error) {
            console.log(error);
            throw error;
        }
    }

}

module.exports = PedidosServices;
