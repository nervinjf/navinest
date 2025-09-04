// src/controllers/email-allowlist.controller.js
const AllowListServices = require("../services");

// Si tienes auth middleware, normalmente vendrá req.user.id
const getUsuarioId = (req) => req.user?.id || req.headers["x-user-id"] || null;

async function list(req, res, next) {
  try {
    const { page, limit, q, active } = req.query;
    const data = await AllowListServices.listAllowlist({ page, limit, q, active });
    res.json(data);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const usuarioId = getUsuarioId(req);
    const row = await AllowListServices.createAllow({ ...req.body }, usuarioId);
    res.status(201).json(row);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const usuarioId = getUsuarioId(req);
    const { id } = req.params;
    const row = await AllowListServices.updateAllow(id, req.body, usuarioId);
    res.json(row);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const usuarioId = getUsuarioId(req);
    const { id } = req.params;
    const out = await AllowListServices.deleteAllow(id, usuarioId);
    res.json(out);
  } catch (err) { next(err); }
}

async function setActive(req, res, next) {
  try {
    const usuarioId = getUsuarioId(req);
    const { id } = req.params;
    const { isActive } = req.body;
    const row = await AllowListServices.toggleActive(id, isActive, usuarioId);
    res.json(row);
  } catch (err) { next(err); }
}

async function check(req, res, next) {
  try {
    const { email } = req.query;
    const allowed = await AllowListServices.isSenderAllowed(email);
    res.json({ email, allowed });
  } catch (err) { next(err); }
}

module.exports = {
  list,
  create,
  update,
  remove,
  setActive,
  check,
};
