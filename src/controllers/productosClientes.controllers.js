const { ProductosClientesServices } = require('../services');
const fs = require("fs");

const CreateBulkPClientes = async (req, res, next) => {
    try {
        const {id} = req.params; // Asumiendo que el ID del usuario está en req.user.id
        const filePath = req.file?.path;
        if (!filePath) {
            return res.status(400).json({ message: "No se subió ningún archivo" });
        }

        const usuarioId = req.user?.id || 1; // Asegúrate que `req.user` esté definido por middleware de auth


        const result = await ProductosClientesServices.bulkCreate(filePath, id, usuarioId);
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

const editBulkPClientes = async (req, res, next) => {
    try {
        const filePath = req.file?.path;
        if (!filePath) {
            return res.status(400).json({ message: "No se subió ningún archivo" });
        }
                const usuarioId = req.user?.id || 0; // Asegúrate que `req.user` esté definido por middleware de auth

        const result = await ProductosClientesServices.editBulk(filePath, usuarioId);
        // Eliminar archivo temporal
        fs.unlinkSync(filePath);

        res.json(result);
    } catch (error) {
        next({
            status: 500,
            errorContent: error,
            message: "Error al editar productos"
        })
    }
}

const ListProductsClientes = async (req, res, next) => {
    try {

        const {id} = req.params;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 8;

        const filtros = {
            busqueda: req.query.busqueda?.trim() || null,
            estado: req.query.estado?.trim() || null,
            categoria: req.query.categoria?.trim() || null,
            unidadNegocio: req.query.unidadNegocio?.trim() || null,
        };

        const result = await ProductosClientesServices.listProducts(filtros, page, limit, id);
        res.json(result);

    } catch (error) {
        next({
            status: 400,
            errorContent: error,
            message: "faltan datos",
        })
    }
};

const createProductClientes = async (req, res, next) => {
    try {
        const data = req.body;
                const usuarioId = req.user?.id || 1; // Asegúrate que `req.user` esté definido por middleware de auth

        const result = await ProductosClientesServices.postOne(data, usuarioId);
        res.json(result);
    } catch (error) {
        next({
            status: 400,
            errorContent: error,
            message: "Algo salio mal"
        })
    }
}

const updateProductClientes = async (req, res, next) => {
    try {
        const data = req.body;
           const {id} = req.params;
                const usuarioId = req.user?.id || 1; // Asegúrate que `req.user` esté definido por middleware de auth

        const result = await ProductosClientesServices.update(data, id, usuarioId);
        res.json(result);
    } catch (error) {
        next({
            status: 400,
            errorContent: error,
            message: "Algo salio mal"
        })
    }
}

module.exports = {
    CreateBulkPClientes,
    editBulkPClientes,
    ListProductsClientes,
    createProductClientes,
    updateProductClientes
}