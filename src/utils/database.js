const { Sequelize } = require("sequelize");
require("dotenv").config();
const mysql2 = require("mysql2");

const db = new Sequelize({
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
  dialect: "mysql",
  logging: false,
   timezone: '-04:00',  // Ajusta la zona horaria según tu ubicación
  useUTC: false,
});

module.exports = db;