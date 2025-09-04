const { ClientesServices } = require('../services');
const fs = require("fs");

const CreateBulkClientes = async (req, res, next) => {
    try {
        const filePath = req.file?.path;
        if (!filePath) {
            return res.status(400).json({ message: "No se subió ningún archivo" });
        }
        const usuarioId = req.user?.id || 1; // Asegúrate que `req.user` esté definido por middleware de auth


        const result = await ClientesServices.bulkCreate(filePath,usuarioId);
        // Eliminar archivo temporal
        fs.unlinkSync(filePath);

        res.json(result);

    } catch (error) {
        next({
            status: 500,
            errorContent: error,
            message: "Error al verificar OTP"
        })
    }
}

const clienteById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;

        const result = await ClientesServices.getByIdConPedidosPaginados(id, page);
        res.json(result);
    } catch (error) {
        next({
            status: 500,
            errorContent: error,
            message: "Error al obtener cliente por ID"
        })
    }
}


const ListClientes = async (req, res, next) => {
    try {

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const filtros = {
            status: req.query.status?.trim() || null,
            nombre: req.query.nombre?.trim() || null,
        };

        const result = await ClientesServices.listClient(filtros, page, limit);
        res.json(result);

    } catch (error) {
        next({
            status: 400,
            errorContent: error,
            message: "faltan datos",
        })
    }
};

const createCliente = async (req, res, next) => {
    try {
        const data = req.body;
        const usuarioId = req.user?.id || 1; // Asegúrate que `req.user` esté definido por middleware de auth

        const result = await ClientesServices.postOne(data, usuarioId);
        res.json(result);
    } catch (error) {
        next({
            status: 400,
            errorContent: error,
            message: "Algo salio mal"
        })
    }
}

const updateCLiente = async (req, res, next) => {
    try {
        const data = req.body;
        const { id } = req.params;
        const usuarioId = req.user?.id || 0; // Asegúrate que `req.user` esté definido por middleware de auth

        const result = await ClientesServices.update(data, id, usuarioId);
        res.json(result);
    } catch (error) {
        next({
            status: 400,
            errorContent: error,
            message: "Algo salio mal"
        })
    }
}

const deleteCLiente = async (req, res, next) => {
    try {
        const { id } = req.params;
        const usuarioId = req.user?.id || 0; // Asegúrate que `req.user` esté definido por middleware de auth


        const result = await ClientesServices.delete(id, usuarioId);
        res.json(result);
    } catch (error) {
        next({
            status: 400,
            errorContent: error,
            message: "Error al eliminar cliente"
        })
    }
}

module.exports = {
    ListClientes,
    clienteById,
    CreateBulkClientes,
    createCliente,
    updateCLiente,
    deleteCLiente
}