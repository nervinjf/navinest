// models/_jsonType.js
const { DataTypes } = require("sequelize");

module.exports = (db) => {
  const dialect = db.getDialect ? db.getDialect() : "";
  // Postgres soporta JSONB, MSSQL no (usamos TEXT como fallback)
  if (dialect === "postgres") {
    return DataTypes.JSONB;
  }
  return DataTypes.TEXT;
};
