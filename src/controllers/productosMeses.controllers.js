const {ProductosMesesService} = require("../services");

const crearMesActivo = async (req, res, next) => {
  try {
    const { productoId } = req.params;
    const { meses } = req.body; // <-- array de meses
    const usuarioId = req.usuario?.id;

    const resultado = await ProductosMesesService.agregarMeses(productoId, meses, usuarioId);
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
};

const eliminarMesActivo = async (req, res, next) => {
  try {
    const { productoId, mes } = req.params;
    const usuarioId = req.usuario?.id;

    const eliminado = await ProductosMesesService.eliminarMes(productoId, mes, usuarioId);
    res.status(200).json({ eliminado });
  } catch (error) {
    next(error);
  }
};

const listarMesesPorProducto = async (req, res, next) => {
  try {
    const { productoId } = req.params;
    const meses = await ProductosMesesService.listarMeses(productoId);
    res.status(200).json(meses);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  crearMesActivo,
  eliminarMesActivo,
  listarMesesPorProducto,
};
