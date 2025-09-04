const db = require("../utils/database");
const { DataTypes } = require("sequelize");

const Pedidos = db.define('pedidos', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
    },
    clienteId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "cliente_id",
        references: { model: 'clientes', key: 'id' }
    },
    fecha_pedido: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: "fecha_pedido"
    },
    archivo_pdf: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "archivo_pdf"
    },
    archivo_excel: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "archivo_excel"
    },
    nombre: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    estado: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'en_espera' // Valores posibles: en_espera, procesado, error
    },
    intentos_procesar: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },

    // 🔹 Totales para reportería
    montoOkUsd: { type: DataTypes.DECIMAL(18, 2), allowNull: true, defaultValue: 0, field: "monto_ok_usd" },
    montoFailUsd: { type: DataTypes.DECIMAL(18, 2), allowNull: true, defaultValue: 0, field: "monto_fail_usd" },
    montoUsd: { type: DataTypes.DECIMAL(18, 2), allowNull: true, defaultValue: 0, field: "monto_usd" },
});

module.exports = Pedidos;