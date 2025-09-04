const db = require("../utils/database");
const { DataTypes } = require("sequelize");

const IngestionJobPedido = db.define("ingestion_job_pedidos", {
  id:       { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  jobId:    { type: DataTypes.INTEGER, allowNull: false, field: "job_id" },
  pedidoId: { type: DataTypes.INTEGER, allowNull: false, field: "pedido_id" },
}, { underscored: true, indexes: [
  { unique: true, fields: ["job_id", "pedido_id"] },
  { fields: ["job_id"] },
  { fields: ["pedido_id"] },
] });

module.exports = IngestionJobPedido;
