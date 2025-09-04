// models/TemporaryUser.js

const db = require("../utils/database");
const { DataTypes } = require("sequelize");

const TemporaryUser = db.define('temporary_users', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
    },
    nombre: {
        type: DataTypes.STRING(250),
        allowNull: false,
    },
    apellido: {
        type: DataTypes.STRING(250),
        allowNull: false,
    },
    correo: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isEmail: true,
        },
    },
    password: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    telefono: {
        type: DataTypes.STRING(20),
        allowNull: false,
    },
    tipoCedula: {
        type: DataTypes.STRING(5),
        allowNull: false,
    },
    cedula: {
        type: DataTypes.STRING(15),
        allowNull: false,
    },
    otp: {
        type: DataTypes.STRING(6), // Longitud del OTP
        allowNull: true, // Permitir que el campo sea nulo mientras se espera el OTP
    },
    horaotp: {
        type: DataTypes.DATE, // Longitud del OTP
        allowNull: true, // Permitir que el campo sea nulo mientras se espera el OTP
    },
    rol: {
        type: DataTypes.STRING(25), // Longitud del OTP
        allowNull: true, // Permitir que el campo sea nulo mientras se espera el OTP
    },
    intentos: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
});

module.exports = TemporaryUser;