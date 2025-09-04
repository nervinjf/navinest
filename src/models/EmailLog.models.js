// models/EmailLog.js
const db = require("../utils/database");
const { DataTypes } = require("sequelize");
const jsonType = require("./_jsonType")(db);

const EmailLog = db.define("email_logs", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },

  // 👉 NUEVO CAMPO REQUERIDO
  idempotencyKey: {
    type: DataTypes.STRING(128),
    allowNull: false,
    field: "idempotency_key",
  },

  messageId:   { type: DataTypes.STRING, allowNull: true,  field: "message_id" },
  to:          { type: DataTypes.STRING, allowNull: false },
  subject:     { type: DataTypes.STRING, allowNull: true },
  status:      { type: DataTypes.STRING, allowNull: false }, // 'pending' | 'sent' | 'failed' | 'skipped'
  errorMessage:{ type: DataTypes.TEXT,   allowNull: true,  field: "error_message" },
  attempt:     { type: DataTypes.INTEGER,allowNull: false, defaultValue: 1 },
  providerResponse: { type: DataTypes.JSON, allowNull: true, field: "provider_response" },
  meta:        { type: DataTypes.JSON, allowNull: true },
  sentAt:      { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: "sent_at" },
}, {
  underscored: true,
  indexes: [
    { fields: ["sent_at"] },
    { fields: ["status", "sent_at"] },
    { unique: true, fields: ["idempotency_key"], name: "uniq_email_logs_idempotency_key" },
  ],
});

module.exports = EmailLog;

