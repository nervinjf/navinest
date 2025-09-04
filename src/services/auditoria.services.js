const { Op } = require('sequelize');
const { Productos, Clientes, Pedidos, Auditoria, Users } = require('../models');
const xlsx = require("xlsx");

class AuditoriaServices {

    static async listauditoria(page = 1, limit = 10) {

        const offset = (page - 1) * limit;

        try {
            const { count, rows } = await Auditoria.findAndCountAll({
                limit,
                include: [{
                    model: Users,
                    as: "user",
                    attributes: ["nombre", "apellido"]
                }],
                offset,
                order: [["fechaCambio", "DESC"]],
            });

            return {
                total: count,
                paginas: Math.ceil(count / limit),
                paginaActual: page,
                registros: rows,
            };
        } catch (error) {
            console.log(error)
            throw error;
        }
    }

}

module.exports = AuditoriaServices;
