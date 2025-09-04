// services/estadoMensual.service.js
const { Op, fn, col, Sequelize } = require("sequelize");
const Productos = require("../models/productos.models");
const ProductosMeses = require("../models/productos_meses.models");

async function syncEstadoMensualSoloRegulados(usuarioId = null) {
  const mesActual = new Date().getMonth() + 1;

  // 1) Obtener TODOS los productoIds que están regulados por productos_meses (DISTINCT)
  const regulados = await ProductosMeses.findAll({
    attributes: [[fn("DISTINCT", col("producto_id")), "productoId"]],
    raw: true,
  });
  const idsRegulados = regulados.map(r => r.productoId);

  if (idsRegulados.length === 0) {
    return { mesActual, regulados: 0, puestosInactivos: 0, puestosActivos: 0 };
  }

  // 2) Poner INACTIVO por defecto a todos los regulados cuyo estado = 'activo_meses'
  const [puestosInactivos] = await Productos.update(
    { estado_vigente: "inactivo" },
    {
      where: {
        id: { [Op.in]: idsRegulados },
        estado: "activo_meses",
      },
    }
  );

  // 3) Activar SOLO los que tienen registro del mes actual
  const activosEsteMes = await ProductosMeses.findAll({
    attributes: ["producto_id"],
    where: { mes: mesActual },
    raw: true,
  });
  const idsActivos = activosEsteMes.map(a => a.producto_id);

  let puestosActivos = 0;
  if (idsActivos.length > 0) {
    const [count] = await Productos.update(
      { estado_vigente: "activo" },
      {
        where: {
          id: { [Op.in]: idsActivos },
          estado: "activo_meses",
        },
      }
    );
    puestosActivos = count;
  }

  return {
    mesActual,
    regulados: idsRegulados.length,
    puestosInactivos,
    puestosActivos,
  };
}

module.exports = { syncEstadoMensualSoloRegulados };
