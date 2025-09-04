const { AuditoriaServices } = require('../services');
const fs = require("fs");


const ListAuditoria = async (req, res, next) => {
    try {

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const result = await AuditoriaServices.listauditoria(page, limit);
        res.json(result);

    } catch (error) {
        next({
            status: 400,
            errorContent: error,
            message: "faltan datos",
        })
    }
};

module.exports = {
    ListAuditoria,
}