const db = require("../utils/database");
const { DataTypes } = require("sequelize");
const Auditoria = require("./auditoria.models");

async function calcularEstadoVigente(registro) {
  const estado = registro.estado;
  if (estado === "activo") return "activo";
  if (estado === "inactivo") return "inactivo";

  // estado === "activo_meses"
  const mesActual = new Date().getMonth() + 1;

  if (!registro.id) return "inactivo";

  const ProductosMeses = db.models.productos_meses; // asegúrate de inicializar este modelo antes
  const existeMes = await ProductosMeses.findOne({
    where: { producto_id: registro.id, mes: mesActual },
    attributes: ["id"],
  });

  return existeMes ? "activo" : "inactivo";
}

const Productos = db.define(
  "productos",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM("activo", "inactivo", "activo_meses"),
      allowNull: false,
      defaultValue: "activo",
    },
    estado_vigente: {
      type: DataTypes.ENUM("activo", "inactivo"),
      allowNull: false,
      defaultValue: "activo",
    },
    codigoSAP: {
      type: DataTypes.STRING,
      allowNull: false,
      // ❌ NO pongas unique aquí; el índice lo definimos abajo
    },
    codigoBarraUV: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    producto: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    uniPorDisplay: { type: DataTypes.INTEGER, allowNull: true },
    displaysPorBulto: { type: DataTypes.INTEGER, allowNull: true },
    unidadesPorBulto: { type: DataTypes.INTEGER, allowNull: true },
    categoria: { type: DataTypes.STRING, allowNull: false },
    unidadNegocio: { type: DataTypes.STRING, allowNull: true },
    SalesOrg: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "sales_org", // mapea a la columna existente
    },
  },
  {
    tableName: "productos",
    // 👇 Índices controlados
    indexes: [
      {
        name: "ux_productos_codigoSAP",
        unique: true,
        fields: ["codigoSAP"],
      },
    ],
    hooks: {
      beforeCreate: async (registro, options) => {
        if (registro.estado === "activo") registro.estado_vigente = "activo";
        else if (registro.estado === "inactivo") registro.estado_vigente = "inactivo";
        else registro.estado_vigente = "inactivo";
      },
      afterCreate: async (registro, options) => {
        try {
          if (registro.estado === "activo_meses") {
            const vigente = await calcularEstadoVigente(registro);
            if (vigente !== registro.estado_vigente) {
              await registro.update({ estado_vigente: vigente }, { silent: true });
            }
          }
          if (!options?.usuarioId || options?.esBulk) return;
          await Auditoria.create({
            user_id: options.usuarioId,
            modulo: "productos",
            entidadId: registro.id,
            campo: "RESUMEN",
            valorAnterior: null,
            valorNuevo: `🆕 Producto creado individualmente (ID: ${registro.id})`,
            accion: "CREAR",
            fechaCambio: new Date(),
          });
        } catch (error) {
          console.error("❌ Error en afterCreate Productos:", error);
        }
      },
      beforeUpdate: async (registro, options) => {
        if (registro.changed("estado") || options?.recalcularEstadoVigente) {
          registro.estado_vigente = await calcularEstadoVigente(registro);
        }

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
              user_id: options?.usuarioId || null,
              modulo: "productos",
              entidadId: registro.id,
              campo,
              valorAnterior: anterior[campo],
              valorNuevo: nuevo[campo],
              accion: "ACTUALIZAR",
              fechaCambio: new Date(),
            });
          }
        }
        if (cambios.length > 0) await Auditoria.bulkCreate(cambios);
      },
      beforeDestroy: async (registro, options) => {
        const cambios = [];
        for (const campo in registro.dataValues) {
          if (campo !== "updatedAt" && campo !== "createdAt" && campo !== "deletedAt") {
            cambios.push({
              user_id: options?.usuarioId || null,
              modulo: "productos",
              entidadId: registro.id,
              campo,
              valorAnterior: registro[campo],
              valorNuevo: null,
              accion: "ELIMINAR",
              fechaCambio: new Date(),
            });
          }
        }
        if (cambios.length > 0) await Auditoria.bulkCreate(cambios);
      },
    },
  }
);

module.exports = Productos;
