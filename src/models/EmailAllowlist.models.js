const db = require("../utils/database");
const { DataTypes } = require("sequelize");
const Auditoria = require("./auditoria.models");

const EmailAllowlist = db.define("email_allowlist", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },

  // Si quieres permitir por email exacto (opcional si usas domain)
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    validate: { isEmail: true },
  },

  // Si quieres permitir por dominio (ej: "empresa.com")
  domain: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      is: /^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/i, // check simple de dominio
    },
  },

  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

  notes: { type: DataTypes.STRING, allowNull: true },

  // Quién creó la entrada (FK opcional a users.id)
  created_by: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: "email_allowlist",
  underscored: true,
  indexes: [
    { fields: ["email"] },
    { fields: ["domain"] },
    { fields: ["is_active"] },
  ],
  validate: {
    emailOrDomainRequired() {
      if (!this.email && !this.domain) {
        throw new Error("Debe especificar 'email' o 'domain' en email_allowlist.");
      }
    },
  },

  hooks: {
    /* ===== Auditoría ===== */
    async afterCreate(row, options) {
      try {
        await Auditoria.create({
          user_id: options?.usuarioId || row.created_by || null,
          modulo: "email_allowlist",
          entidadId: row.id,
          campo: "TODOS",
          valorAnterior: null,
          valorNuevo: JSON.stringify(row.dataValues),
          accion: "CREAR",
        });
      } catch {}
    },

    async beforeUpdate(row, options) {
      try {
        const viejo = row._previousDataValues;
        const nuevo = row.dataValues;
        const cambios = [];

        for (const campo in nuevo) {
          if (["updatedAt", "createdAt"].includes(campo)) continue;
          if (nuevo[campo] !== viejo[campo]) {
            cambios.push({
              user_id: options?.usuarioId || null,
              modulo: "email_allowlist",
              entidadId: row.id,
              campo,
              valorAnterior: viejo[campo],
              valorNuevo: nuevo[campo],
              accion: "ACTUALIZAR",
            });
          }
        }

        if (cambios.length > 0) {
          await Auditoria.bulkCreate(cambios);
        }
      } catch {}
    },

    async beforeDestroy(row, options) {
      try {
        await Auditoria.create({
          user_id: options?.usuarioId || null,
          modulo: "email_allowlist",
          entidadId: row.id,
          campo: "TODOS",
          valorAnterior: JSON.stringify(row.dataValues),
          valorNuevo: null,
          accion: "ELIMINAR",
        });
      } catch {}
    },
  },
});

module.exports = EmailAllowlist;
