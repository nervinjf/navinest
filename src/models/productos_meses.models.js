const db = require("../utils/database");
const { DataTypes } = require("sequelize");
const Auditoria = require("./auditoria.models");

const ProductosMeses = db.define(
  "productos_meses",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    productoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "producto_id",
    },
    mes: {
      type: DataTypes.INTEGER, // 1 = enero, 12 = diciembre
      allowNull: false,
    },
  },
  {
    hooks: {
      // 🔁 UPDATE
      beforeUpdate: async (registro, options) => {
        const cambios = [];
        const anterior = registro._previousDataValues;
        const nuevo = registro.dataValues;

        for (const campo in nuevo) {
          if (
            nuevo[campo] !== anterior[campo] &&
            campo !== "updatedAt" &&
            campo !== "createdAt"
          ) {
            cambios.push({
              usuarioId: options.usuarioId || null,
              modulo: "productos_meses",
              entidadId: registro.id,
              campo,
              valorAnterior: anterior[campo],
              valorNuevo: nuevo[campo],
            });
          }
        }

        if (cambios.length > 0) {
          await Auditoria.bulkCreate(cambios);
        }
      },

      // ✅ CREATE
      afterCreate: async (registro, options) => {
        if (options.usuarioId && !options.esBulk) {
          await Auditoria.create({
            user_id: options.usuarioId,
            modulo: "productos_meses",
            entidadId: registro.id,
            campo: "RESUMEN",
            valorAnterior: null,
            valorNuevo: `🆕 Mes ${registro.mes} activado para producto ${registro.productoId}`,
            accion: "CREAR",
            fechaCambio: new Date(),
          });
        }
      },

      // ❌ DELETE
      beforeDestroy: async (registro, options) => {
        if (options.usuarioId) {
          const cambios = Object.entries(registro.dataValues).map(
            ([campo, valorAnterior]) => ({
              usuarioId: options.usuarioId,
              modulo: "productos_meses",
              entidadId: registro.id,
              campo,
              valorAnterior,
              valorNuevo: null,
            })
          );

          await Auditoria.bulkCreate(cambios);
        }
      },
    },
  }
);

module.exports = ProductosMeses;
