const {ProductosMeses} = require("../models");

class ProductosMesesService {
     static async agregarMeses(productoId, meses, usuarioId) {
        if (!Array.isArray(meses) || meses.length === 0) {
            throw new Error("Debes enviar un array de meses.");
        }

        // Quitar duplicados locales
        const mesesUnicos = [...new Set(meses.map(m => parseInt(m)))];

        // Validar que los meses sean válidos (1 a 12)
        for (let mes of mesesUnicos) {
            if (mes < 1 || mes > 12) {
                throw new Error(`Mes inválido: ${mes}. Debe estar entre 1 y 12.`);
            }
        }

        // Buscar los ya existentes en la DB para evitar duplicados
        const existentes = await ProductosMeses.findAll({
            where: {
                productoId,
                mes: mesesUnicos
            }
        });

        const mesesExistentes = existentes.map(m => m.mes);
        const nuevosMeses = mesesUnicos.filter(m => !mesesExistentes.includes(m));

        // Crear los nuevos registros
        const registros = nuevosMeses.map(mes => ({
            productoId,
            mes
        }));

        const resultado = await ProductosMeses.bulkCreate(registros, {
            individualHooks: true,
            usuarioId
        });

        return {
            creados: resultado.length,
            ignorados: mesesExistentes.length,
            mesesCreados: nuevosMeses,
            mesesIgnorados: mesesExistentes
        };
    };

    static async eliminarMes(productoId, mes, usuarioId) {
        const registro = await ProductosMeses.findOne({
            where: { productoId, mes }
        });

        if (!registro) {
            throw new Error("Registro no encontrado.");
        }

        await registro.destroy({ usuarioId });

        return true;
    };

    static async listarMeses(productoId) {
        const meses = await ProductosMeses.findAll({
            where: { productoId },
            attributes: ["mes"]
        });

        return meses.map(m => m.mes);
    };

    static async limpiarMeses(productoId, transaction = null) {
        await ProductosMeses.destroy({
            where: { productoId },
            transaction
        });
        return true;
    };

}

module.exports = ProductosMesesService;
