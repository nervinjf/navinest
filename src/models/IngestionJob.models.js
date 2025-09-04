// models/IngestionJob.js
const db = require("../utils/database");
const { DataTypes } = require("sequelize");

const IngestionJob = db.define("ingestion_jobs", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },

  source:   { type: DataTypes.STRING, allowNull: false, defaultValue: "email" }, // 'email'|'upload'|'api'
  sourceId: { type: DataTypes.STRING, allowNull: true,  field: "source_id" },    // messageId / uploadId

  // 🔗 Trazabilidad
  emailInboundId: { type: DataTypes.INTEGER, allowNull: true, field: "email_inbound_id" },

  // Relaciones negocio
  clienteId: { type: DataTypes.INTEGER, allowNull: true, field: "cliente_id" },
  pedidoId:  { type: DataTypes.INTEGER, allowNull: true, field: "pedido_id" },

  // Archivo PDF (uno por job idealmente)
  pdfName:        { type: DataTypes.STRING, allowNull: true,  field: "pdf_name" },
  filePath:       { type: DataTypes.STRING, allowNull: true,  field: "file_path" },
  fileHashSha256: { type: DataTypes.STRING(64), allowNull: true, field: "file_hash_sha256" },
  fileSizeBytes:  { type: DataTypes.INTEGER, allowNull: true, field: "file_size_bytes" },

  // Estado
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: "queued" }, // 'queued'|'processing'|'processed'|'partial'|'error'

  // Azure
  azureOperationId: { type: DataTypes.STRING, allowNull: true, field: "azure_operation_id" },
  azureModelId:     { type: DataTypes.STRING, allowNull: true, field: "azure_model_id" },
  pagesDetected:    { type: DataTypes.INTEGER, allowNull: true, field: "pages_detected" },
  pagesAzure:       { type: DataTypes.INTEGER, allowNull: true, field: "pages_azure" },
  compareOk:        { type: DataTypes.BOOLEAN, allowNull: true, field: "compare_ok" },
  azureDurationMs:  { type: DataTypes.INTEGER, allowNull: true, field: "azure_duration_ms" },

  // ⬅️ KPIs sin joins
  hasOkLine:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "has_ok_line" },
  hasFailLine: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "has_fail_line" },

  // Errores / timing
  errorDetails: { type: DataTypes.TEXT,  allowNull: true,  field: "error_details" },
  startedAt:    { type: DataTypes.DATE,  allowNull: true,  field: "started_at" },
  finishedAt:   { type: DataTypes.DATE,  allowNull: true,  field: "finished_at" },
  durationMs:   { type: DataTypes.INTEGER, allowNull: true, field: "duration_ms" },
}, {
  underscored: true,
  indexes: [
    { fields: ["started_at"] },
    { fields: ["status", "finished_at"] },
    { fields: ["cliente_id", "started_at"] },
    { fields: ["pedido_id"] },
    { fields: ["source_id"] },
      { fields: ["source", "source_id"] },       // ← útil cuando source='email'
    { fields: ["email_inbound_id"] },
  ],
});

module.exports = IngestionJob;
