// src/services/allowlist.service.js
const { Op } = require("sequelize");
const EmailAllowlist = require("../models");

const norm = (v) => String(v || "").trim().toLowerCase();
const domainOf = (email) =>
  (String(email).includes("@") ? String(email).split("@")[1] : "");

class AllowListServices {
  // 📌 Listar con paginación y filtros
  static async list({ page = 1, limit = 20, q = "", active }) {
    const where = {};
    if (q) {
      where[Op.or] = [
        { email: { [Op.like]: `%${q}%` } },
        { domain: { [Op.like]: `%${q}%` } },
        { notes: { [Op.like]: `%${q}%` } },
      ];
    }
    if (active !== undefined && active !== null && active !== "") {
      where.isActive = active === "true" || active === true;
    }

    const offset = (Number(page) - 1) * Number(limit);
    const { rows, count } = await EmailAllowlist.findAndCountAll({
      where,
      order: [["id", "DESC"]],
      offset,
      limit: Number(limit),
    });

    return {
      rows,
      total: count,
      paginaActual: Number(page),
      paginas: Math.max(1, Math.ceil(count / Number(limit))),
    };
  }

  // 📌 Crear un registro
  static async create(data, usuarioId) {
    const payload = {
      email: data.email ? norm(data.email) : null,
      domain: data.domain ? norm(data.domain) : null,
      isActive: !!data.isActive,
      notes: data.notes ?? null,
      created_by: usuarioId || null,
    };

    if (!payload.email && !payload.domain) {
      throw new Error("Debe enviar 'email' o 'domain'.");
    }

    if (payload.email) {
      const exists = await EmailAllowlist.findOne({ where: { email: payload.email } });
      if (exists) throw new Error("Ese email ya está en la allowlist.");
    }
    if (payload.domain) {
      const exists = await EmailAllowlist.findOne({ where: { domain: payload.domain } });
      if (exists) throw new Error("Ese dominio ya está en la allowlist.");
    }

    return await EmailAllowlist.create(payload, { usuarioId });
  }

  // 📌 Actualizar un registro
  static async update(id, data, usuarioId) {
    const row = await EmailAllowlist.findByPk(id);
    if (!row) throw new Error("Registro no encontrado.");

    const patch = {};
    if (data.email !== undefined) patch.email = data.email ? norm(data.email) : null;
    if (data.domain !== undefined) patch.domain = data.domain ? norm(data.domain) : null;
    if (data.isActive !== undefined) patch.isActive = !!data.isActive;
    if (data.notes !== undefined) patch.notes = data.notes ?? null;

    if (patch.email) {
      const dupe = await EmailAllowlist.findOne({
        where: { email: patch.email, id: { [Op.ne]: id } },
      });
      if (dupe) throw new Error("Ese email ya está en la allowlist.");
    }
    if (patch.domain) {
      const dupe = await EmailAllowlist.findOne({
        where: { domain: patch.domain, id: { [Op.ne]: id } },
      });
      if (dupe) throw new Error("Ese dominio ya está en la allowlist.");
    }

    await row.update(patch, { usuarioId });
    return row;
  }

  // 📌 Eliminar un registro
  static async delete(id, usuarioId) {
    const row = await EmailAllowlist.findByPk(id);
    if (!row) throw new Error("Registro no encontrado.");
    await row.destroy({ usuarioId });
    return { ok: true };
  }

  // 📌 Cambiar estado activo/inactivo
  static async toggleActive(id, isActive, usuarioId) {
    const row = await EmailAllowlist.findByPk(id);
    if (!row) throw new Error("Registro no encontrado.");
    await row.update({ isActive: !!isActive }, { usuarioId });
    return row;
  }

  // 📌 Validar remitente
  static async isSenderAllowed(remitenteEmail) {
    const email = norm(remitenteEmail);
    if (!email) return false;
    const domain = domainOf(email);

    const row = await EmailAllowlist.findOne({
      where: {
        isActive: true,
        [Op.or]: [{ email }, { domain }],
      },
      raw: true,
    });
    return !!row;
  }
}

module.exports = AllowListServices;
