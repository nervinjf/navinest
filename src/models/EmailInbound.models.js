// models/EmailInbound.js
const db = require("../utils/database");
const { DataTypes } = require("sequelize");

const EmailInbound = db.define("email_inbound", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  messageId:        { type: DataTypes.STRING(255), allowNull: false, unique: true, field: "message_id" },
  fromAddr:         { type: DataTypes.STRING(255), allowNull: true,  field: "from_addr" },
  toAddr:           { type: DataTypes.STRING(255), allowNull: true,  field: "to_addr" },
  subject:          { type: DataTypes.TEXT,        allowNull: true },

  receivedAt:       { type: DataTypes.DATE,        allowNull: false, defaultValue: DataTypes.NOW, field: "received_at" },

  whitelistOk:      { type: DataTypes.BOOLEAN,     allowNull: true,  field: "whitelist_ok" },

  attachmentsTotal: { type: DataTypes.INTEGER,     allowNull: false, defaultValue: 0, field: "attachments_total" },
  attachmentsPdfs:  { type: DataTypes.INTEGER,     allowNull: false, defaultValue: 0, field: "attachments_pdfs" },

  // Auditoría POP3
  deletedFromServer:{ type: DataTypes.BOOLEAN,     allowNull: true,  field: "deleted_from_server" },
  msgSizeBytes:     { type: DataTypes.INTEGER,     allowNull: true,  field: "msg_size_bytes" },

  // Detalle opcional de adjuntos / meta (usar JSON en MySQL)
  attachmentsMeta:  { type: DataTypes.JSON,        allowNull: true,  field: "attachments_meta" },
  meta:             { type: DataTypes.JSON,        allowNull: true },
}, {
  underscored: true,
  indexes: [
    { fields: ["received_at"] },
    { fields: ["from_addr"] },
    { fields: ["whitelist_ok"] },
    // NO repitas unique index para message_id: ya es unique en la columna
  ],
});

module.exports = EmailInbound;
