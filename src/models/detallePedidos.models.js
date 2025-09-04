const db = require("../utils/database");
const { DataTypes } = require("sequelize");

const DetallePedidos = db.define('detalle_pedidos', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
    },
    pedidoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "pedido_id",
    },
    cantidad: {
         type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
    },
    productoId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "producto_id",
    },
    observacionConversion: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "observacion_conversion"
    },
    totalLineaUsd: { type: DataTypes.DECIMAL(18, 2), allowNull: true, field: "total_linea_usd" },
});

module.exports = DetallePedidos;