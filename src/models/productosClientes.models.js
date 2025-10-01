const db = require("../utils/database");
const { DataTypes } = require("sequelize");
const Auditoria = require("./auditoria.models");

const ProductosClientes = db.define('productos_clientes', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
  productoId: { type: DataTypes.INTEGER, allowNull: false, field: 'producto_id' },
  clienteId:  { type: DataTypes.INTEGER, allowNull: false, field: 'cliente_id' }, // usa minúscula consistente
  codigoCliente: { type: DataTypes.STRING(255), allowNull: true, field: 'codigo_cliente' },
  estado: { type: DataTypes.ENUM('global','activo'), allowNull: false, defaultValue: 'global' }
  },
  {
  freezeTableName: true,
  // underscored: true,  // si quieres timestamps como created_at/updated_at
  indexes: [
    { name: 'uniq_codigo_cliente', unique: true, fields: ['codigo_cliente'] },
    // si necesitas búsquedas por llaves foráneas, puedes añadir índices NO únicos:
    // { name: 'idx_producto_id', fields: ['producto_id'] },
    // { name: 'idx_cliente_id',  fields: ['cliente_id']  },
  ]
},{
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
              user_id: options.usuarioId || null,
              modulo: "productos_clientes",
              entidadId: registro.id,
              campo,
              valorAnterior: anterior[campo],
              valorNuevo: nuevo[campo],
              accion: "ACTUALIZAR",
              fechaCambio: new Date(),
            });
          }
        }

        if (cambios.length > 0) {
          await Auditoria.bulkCreate(cambios);
        }
      },

      // ✅ CREATE
      afterCreate: async (registro, options) => {
        if (options.usuarioId) {

          if (!options.usuarioId || options.esBulk) return;


          await Auditoria.create({
            user_id: options.usuarioId,
            modulo: "productos_clientes",
            entidadId: registro.id,
            campo: "RESUMEN",
            valorAnterior: null,
            valorNuevo: `🆕 Producto creado individualmente (ID: ${registro.id})`,
            accion: "CREAR",
            fechaCambio: new Date()
          })
        }
      },

      // ❌ DELETE
      beforeDestroy: async (registro, options) => {
        if (options.usuarioId) {
          const cambios = Object.entries(registro.dataValues).map(([campo, valorAnterior]) => ({
            usuarioId: options.usuarioId,
            modulo: "productos_clientes",
            entidadId: registro.id,
            campo,
            valorAnterior,
            valorNuevo: null,
          }));

          await Auditoria.bulkCreate(cambios);
        }
      }
    }
  }
);


module.exports = ProductosClientes;
