const { EmailAllowlist } = require("../models");
const { Op } = require("sequelize");

const norm = (s) => String(s || "").trim().toLowerCase();

class AllowListServices {
  static async create(data, usuarioId) {
    const email = data.email ? norm(data.email) : null;
    if (!email) throw new Error("Debe enviar un correo electrónico.");

    const payload = {
      email,
      isActive: data.isActive === undefined ? true : !!data.isActive,
      notes: data.notes ?? null,
      created_by: usuarioId || null,
    };

    const [row, created] = await EmailAllowlist.findOrCreate({
      where: { email },
      defaults: payload,
    });

    if (!created) {
      await row.update(
        {
          isActive: true,
          notes: payload.notes ?? row.notes,
        },
        { usuarioId }
      );
    }
    return row;
  }

  static async setActive(id, isActive, usuarioId) {
    const row = await EmailAllowlist.findByPk(id);
    if (!row) throw new Error("Registro no encontrado.");
    await row.update({ isActive: !!isActive }, { usuarioId });
    return row;
  }

  static async list({ q, onlyActive } = {}) {
    const where = {};
    if (onlyActive) where.isActive = true;
    if (q) where.email = { [Op.like]: `%${q.toLowerCase()}%` };

    return await EmailAllowlist.findAll({ where, order: [["id", "DESC"]] });
  }

  static async remove(id, usuarioId) {
    const row = await EmailAllowlist.findByPk(id);
    if (!row) throw new Error("Registro no encontrado.");
    await row.destroy({ usuarioId });
    return true;
  }

  static async isSenderAllowed(email) {
    const normalized = norm(email);
    const hit = await EmailAllowlist.findOne({
      where: { email: normalized, isActive: true },
    });
    return !!hit;
  }
}

module.exports = AllowListServices;
