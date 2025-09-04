// controllers/estadoMensual.controller.js
const { syncEstadoMensualSoloRegulados } = require("../services/estadoMensual.services");

const ejecutarSyncEstadoMensual = async (req, res, next) => {
  try {
    const usuarioId = req.usuario?.id || null;
    const resultado = await syncEstadoMensualSoloRegulados(usuarioId);
    res.status(200).json({ ok: true, ...resultado });
  } catch (err) {
    next(err);
  }
};

module.exports = { ejecutarSyncEstadoMensual };
