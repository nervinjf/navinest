const { DataTypes } = require("sequelize");
const db = require("../utils/database");

const Auditoria = db.define("auditoria", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: "user_id",
  },
  modulo: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  entidadId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  campo: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  valorAnterior: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  valorNuevo: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  fechaCambio: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  accion: { type: DataTypes.STRING, allowNull: false } // CREAR, ACTUALIZAR, ELIMINAR

});

module.exports = Auditoria;
