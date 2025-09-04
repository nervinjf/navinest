const AllowListServices = require("../services/email-allowlist.services");

exports.list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, q = "", active } = req.query;
    const onlyActive = active === "true";
    const all = await AllowListServices.list({ q, onlyActive });

    const start = (page - 1) * limit;
    const end = start + Number(limit);
    const paged = all.slice(start, end);

    res.json({
      total: all.length,
      paginas: Math.ceil(all.length / limit),
      paginaActual: Number(page),
      registros: paged,
    });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const usuarioId = req.user?.id || null;
    const row = await AllowListServices.create(req.body, usuarioId);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const usuarioId = req.user?.id || null;
    const { id } = req.params;
    const row = await AllowListServices.setActive(id, req.body.isActive, usuarioId);
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.setActive = async (req, res, next) => {
  try {
    const usuarioId = req.user?.id || null;
    const { id } = req.params;
    const { isActive } = req.body;
    const row = await AllowListServices.setActive(id, isActive, usuarioId);
    res.json(row);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const usuarioId = req.user?.id || null;
    const { id } = req.params;
    await AllowListServices.remove(id, usuarioId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.check = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Debe enviar email" });

    const allowed = await AllowListServices.isSenderAllowed(email);
    res.json({ email, allowed });
  } catch (err) {
    next(err);
  }
};
