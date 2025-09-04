const { Op } = require('sequelize');
const { Productos, Clientes, Pedidos } = require('../models');
const xlsx = require("xlsx");

class ClientesServices {
    static async bulkCreate(filePath, usuarioId) {
        try {

            const workbook = xlsx.readFile(filePath);
            const sheet = workbook.SheetNames[0];
            const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet]);

            const nuevosProductos = [];

            for (const row of data) {
                const {
                    nombre,
                    requiere_conversion,
                } = row;

                // Verifica campos obligatorios
                if (!nombre) continue;


                nuevosProductos.push({
                    nombre: nombre,
                    requiere_conversion: requiere_conversion || false,
                });
            }

            if (nuevosProductos.length > 0) {
                await Clientes.bulkCreate(nuevosProductos, {
                    ignoreDuplicates: true,
                    individualHooks: true,
                    usuarioId // ✅ pasamos el usuario para los hooks
                });
            }

            return {
                message: `✅ Se crearon ${nuevosProductos.length} productos nuevos`,
                productos: nuevosProductos.map(p => p.codigoSAP),
            };

        } catch (error) {
            console.error("❌ Error en editBulk:", error); // LOG AL TERMINAL
            console.log(error)
            throw error;
        }
    }

    static async getByIdConPedidosPaginados(id, page = 1, limit = 3) {
        try {
            const cliente = await Clientes.findByPk(id);

            if (!cliente) {
                throw new Error("Cliente no encontrado");
            }

            const offset = (page - 1) * limit;

            const { count, rows } = await Pedidos.findAndCountAll({
                where: { clienteId: cliente.id },
                attributes: ["id", "nombre", "fecha_pedido", "estado", "intentos_procesar"],
                limit,
                offset,
                order: [
                    ["fecha_pedido", "DESC"],
                    ["id", "DESC"]
                ],
            });

            // Obtener el último pedido (más reciente)
            const ultimoPedido = await Pedidos.findOne({
                where: { clienteId: cliente.id },
                attributes: ["id", "nombre", "fecha_pedido", "estado", "intentos_procesar"],
                order: [
                    ["fecha_pedido", "DESC"],
                    ["id", "DESC"]
                ],
            });

            return {
                cliente,
                pedidos: rows,
                totalPedidos: count,
                totalPaginas: Math.ceil(count / limit),
                ultimoPedido, // nuevo campo agregado
            };
        } catch (error) {
            console.error("❌ Error en getByIdConPedidosPaginados:", error);
            throw error;
        }
    }

    static async listClient(filtros, page = 1, limit = 20) {

        const { nombre, status } = filtros;
        const where = {};
        if (status) where.status = status;
        if (nombre) {
            where.nombre = { [Op.like]: `%${nombre.replace(/[%_]/g, "\\$&")}%` }; // escapa % y _
        }

        const offset = (page - 1) * limit;


        try {
            const { count, rows } = await Clientes.findAndCountAll({
                where,
                limit,
                offset,
                order: [["nombre", "ASC"]],
            });

            return {
                total: count,
                paginas: Math.ceil(count / limit),
                paginaActual: page,
                productos: rows,
            };
        } catch (error) {
            throw error;
        }
    }

    static async postOne(data, usuarioId) {
        try {
            const result = await Clientes.create(data, {
                usuarioId
            });
            return result;
        } catch (error) {
            throw error;
        }
    }

    static async update(data, id, usuarioId) {
        try {
            const result = await Clientes.update(data, {
                where: {
                    id: id
                },
                individualHooks: true, // ⚠️ obligatorio para hooks por instancia
                usuarioId
            });
            return result;
        } catch (error) {
            console.log(error)
            throw error;
        }
    }

    static async delete(id, usuarioId) {
        try {
            const cliente = await Clientes.findByPk(id);
            if (!cliente) {
                throw new Error("Cliente no encontrado o ya eliminado");
            }

            // ✅ Elimina pasando usuarioId para que lo tome el hook
            await cliente.destroy({ usuarioId, individualHooks: true });

            return { message: "Cliente eliminado exitosamente" };
        } catch (error) {
            throw error;
        }
    }

}

module.exports = ClientesServices;