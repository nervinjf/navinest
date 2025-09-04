// src/models/sucursales.models.js
const db = require("../utils/database");
const { DataTypes } = require("sequelize");
const Auditoria = require("./auditoria.models");

const Sucursales = db.define('sucursales', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  codigo: {
    type: DataTypes.STRING(250),
    allowNull: false,
  },
  sucursal: {
    type: DataTypes.STRING(250),
    allowNull: false,
  },
  categoria: {
    type: DataTypes.STRING(250),
    allowNull: true,
  },
  clienteId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: "cliente_id",
    references: {
      model: "clientes",
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "RESTRICT",
  },
}, {
  tableName: "sucursales",
  indexes: [
    { name: "idx_sucursales_cliente_id", fields: ["cliente_id"] },
    { name: "idx_sucursales_codigo_cliente", fields: ["codigo"] },
    { name: "uniq_cliente_codigo", unique: true, fields: ["cliente_id", "codigo"] },
  ],
  hooks: {
    async afterCreate(sucursal, options) {
      await Auditoria.create({
        user_id: options.usuarioId || null,
        modulo: "sucursales",
        entidadId: sucursal.id,
        campo: "TODOS",
        valorAnterior: null,
        valorNuevo: JSON.stringify(sucursal.dataValues),
        accion: "CREAR"
      });
    },

    async beforeUpdate(sucursal, options) {
      const cambios = [];
      const viejo = sucursal._previousDataValues;
      const nuevo = sucursal.dataValues;

      for (const campo in nuevo) {
        if (
          nuevo[campo] !== viejo[campo] &&
          campo !== "updatedAt" &&
          campo !== "createdAt"
        ) {
          cambios.push({
            user_id: options.usuarioId || null,
            modulo: "sucursales",
            entidadId: sucursal.id,
            campo,
            valorAnterior: viejo[campo],
            valorNuevo: nuevo[campo],
            accion: "ACTUALIZAR"
          });
        }
      }

      if (cambios.length > 0) {
        await Auditoria.bulkCreate(cambios);
      }
    },

    async beforeDestroy(sucursal, options) {
      await Auditoria.create({
        user_id: options.usuarioId || null,
        modulo: "sucursales",
        entidadId: sucursal.id,
        campo: "TODOS",
        valorAnterior: JSON.stringify(sucursal.dataValues),
        valorNuevo: null,
        accion: "ELIMINAR"
      });
    }
  }
});

module.exports = Sucursales;
