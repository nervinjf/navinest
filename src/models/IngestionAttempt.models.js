// models/IngestionAttempt.models.js  (versión completa compatible MySQL)
const db = require("../utils/database");
const { DataTypes } = require("sequelize");

const IngestionAttempt = db.define("ingestion_attempts", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  jobId: { type: DataTypes.INTEGER, allowNull: true, field: "job_id",
           references: { model: "ingestion_jobs", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },

  attemptNumber: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: "attempt_number" },
  status:        { type: DataTypes.STRING(20), allowNull: false, defaultValue: "error" }, // 'error'|'success'
  startedAt:     { type: DataTypes.DATE, allowNull: true, field: "started_at" },
  finishedAt:    { type: DataTypes.DATE, allowNull: true, field: "finished_at" },
  durationMs:    { type: DataTypes.INTEGER, allowNull: true, field: "duration_ms" },
  errorMessage:  { type: DataTypes.TEXT, allowNull: true, field: "error_message" },
  retriedBy:     { type: DataTypes.STRING(64), allowNull: true, field: "retried_by" },
  retryOrigin:   { type: DataTypes.STRING(32), allowNull: true, field: "retry_origin" },

  meta:          { type: DataTypes.JSON, allowNull: true }, // 👈 aquí
}, {
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ["job_id", "created_at"] },
  ],
});

module.exports = IngestionAttempt;
