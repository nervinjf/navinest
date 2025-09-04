const { ProductosServices } = require('../services');
const fs = require("fs");

const CreateBulk = async (req, res, next) => {
    try {
        const filePath = req.file?.path;
        if (!filePath) {
            return res.status(400).json({ message: "No se subió ningún archivo" });
        }
        const usuarioId = req.user?.id || 1; // Asegúrate que `req.user` esté definido por middleware de auth


        const result = await ProductosServices.bulkCreate(filePath, usuarioId);
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

const editBulk = async (req, res, next) => {
    try {
        const filePath = req.file?.path;
        if (!filePath) {
            return res.status(400).json({ message: "No se subió ningún archivo" });
        }
        const usuarioId = req.user?.id || 1; // Asegúrate que `req.user` esté definido por middleware de auth


        const result = await ProductosServices.editBulk(filePath, usuarioId);
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

const ListProducts = async (req, res, next) => {
    try {

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 8;

        const filtros = {
            busqueda: req.query.busqueda?.trim() || null,
            estado: req.query.estado?.trim() || null,
            categoria: req.query.categoria?.trim() || null,
            unidadNegocio: req.query.unidadNegocio?.trim() || null,
        };

        const result = await ProductosServices.listProducts(filtros, page, limit);
        res.json(result);

    } catch (error) {
        next({
            status: 400,
            errorContent: error,
            message: "faltan datos",
        })
    }
};

const createProduct = async (req, res, next) => {
    try {
        const data = req.body;
        const usuarioId = req.user?.id || 0; // Asegúrate que `req.user` esté definido por middleware de auth


        const result = await ProductosServices.postOne(data, usuarioId);
        res.json(result);
    } catch (error) {
        next({
            status: 400,
            errorContent: error,
            message: "Algo salio mal"
        })
    }
}

const updateProduct = async (req, res, next) => {
    try {
        const data = req.body;
        const { id } = req.params;
        const usuarioId = req.user?.id || 1; // Asegúrate que `req.user` esté definido por middleware de auth

        const result = await ProductosServices.update(data, id, usuarioId);
        res.json(result);
    } catch (error) {
        next({
            status: 400,
            errorContent: error,
            message: "Algo salio mal"
        })
    }
}

const searchProduct = async (req, res, next) =>{
 try {
    
    const { q } = req.query;
    const result = await ProductosServices.searchProducts(q);
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
    CreateBulk,
    editBulk,
    ListProducts,
    createProduct,
    updateProduct,
    searchProduct
}