// models/AzureDailyUsage.js
const db = require("../utils/database");
const { DataTypes } = require("sequelize");

const AzureDailyUsage = db.define("azure_daily_usage", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  region: { type: DataTypes.STRING, allowNull: true },
  azureModelId: { type: DataTypes.STRING, allowNull: true, field: "azure_model_id" },
  documentsProcessed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "documents_processed" },
  pagesProcessed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: "pages_processed" },
  costUsd: { type: DataTypes.DECIMAL(18,6), allowNull: true, field: "cost_usd" },
}, {
  underscored: true,
  indexes: [
    { unique: true, fields: ["date", "azure_model_id", "region"] },
    { fields: ["date"] },
  ],
});

module.exports = AzureDailyUsage;
