const { PedidosServices } = require('../services');
const fs = require("fs");

const pedidoById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await PedidosServices.getById(id);
        res.json(result);
    } catch (error) {
        next({
            status: 500,
            errorContent: error,
            message: "Error al obtener cliente por ID"
        })
    }
}

const Listpedidos = async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 8;

    const filtros = {
      status: req.query.status?.trim() || null,   // 'en_espera' | 'procesado' | 'error'
      nombre: req.query.nombre?.trim() || null,   // texto libre (pedido o cliente)
      fecha:  req.query.fecha?.trim()  || null,   // 'hoy' | 'semana' | 'mes' | 'rango'
      from:   req.query.from?.trim()   || null,   // YYYY-MM-DD (solo si fecha='rango')
      to:     req.query.to?.trim()     || null,   // YYYY-MM-DD (solo si fecha='rango')
      clientesId:     req.query.clientesId?.trim()     || null,   // YYYY-MM-DD (solo si fecha='rango')
    };

    const result = await PedidosServices.listPedidos(filtros, page, limit);
    res.json(result);

  } catch (error) {
    next({
      status: 400,
      errorContent: error,
      message: "faltan datos",
    });
  }
};


const updatePedidos = async (req, res, next) => {
    try {
        const data = req.body;
        const { id } = req.params;
        const usuarioId = req.user?.id || 0; // Asegúrate que `req.user` esté definido por middleware de auth

        const result = await PedidosServices.update(data, id, usuarioId);
        res.json(result);
    } catch (error) {
        next({
            status: 400,
            errorContent: error,
            message: "Algo salio mal"
        })
    }
}

const deletepedidos = async (req, res, next) => {
    try {
        const { id } = req.params;
        const usuarioId = req.user?.id || 0; // Asegúrate que `req.user` esté definido por middleware de auth


        const result = await PedidosServices.delete(id, usuarioId);
        res.json(result);
    } catch (error) {
        next({
            status: 400,
            errorContent: error,
            message: "Error al eliminar cliente"
        })
    }
}

const reprocesarPedido = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ignorarFaltantes } = req.body;

    const resultado = await PedidosServices.procesarPedidoExistente(id, ignorarFaltantes);

    res.json({
      mensaje: "Pedido reprocesado correctamente",
      resultado
    });
  } catch (error) {
    next({
      status: 500,
      errorContent: error,
      message: "Error al reprocesar el pedido"
    });
  }
};

module.exports = {
    Listpedidos,
    pedidoById,
    updatePedidos,
    deletepedidos,
    reprocesarPedido
}