const { Op } = require('sequelize');
const { ProductosClientes, Productos, Auditoria } = require('../models');
const xlsx = require("xlsx");

class ProductosServices {
    static async bulkCreate(filePath, id, usuarioId) {
        try {

            const workbook = xlsx.readFile(filePath);
            const sheet = workbook.SheetNames[0];
            const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet]);

            const nuevosProductos = [];
            const noEncontrados = [];

            console.log(data, id)

            for (const row of data) {
                const {
                    codigoNestle,
                    codigoCliente,
                } = row;

                // Verifica campos obligatorios
                if (!codigoCliente || !codigoNestle || !id) continue;

                const codigoStr = String(codigoCliente).trim();
                const nestleStr = String(codigoNestle).trim();


                // Buscar el producto por codigoNestle (codigoSAP)
                const producto = await Productos.findOne({ where: { codigoSAP: nestleStr } });
                console.log('llegue productos clientes')

                if (!producto) {
                    noEncontrados.push({
                        codigoCliente: codigoStr,
                        codigoNestle: nestleStr,
                    });
                    continue;
                }

                // Verificar si ya existe esa relación
                const existeRelacion = await ProductosClientes.findOne({
                    where: {
                        codigoCliente: codigoStr,
                        clienteId: id,
                        productoId: producto.id,
                    },
                });



                if (existeRelacion) continue;

                nuevosProductos.push({
                    codigoCliente: codigoStr,
                    clienteId: id,
                    productoId: producto.id,
                });
            }

            // Crear relaciones nuevas
            if (nuevosProductos.length > 0) {
                await ProductosClientes.bulkCreate(nuevosProductos, {
                    ignoreDuplicates: true,
                    usuarioId, // se pasa a los hooks
                    esBulk: true
                });
            }

            await Auditoria.create({
                user_id: usuarioId,
                modulo: "productos",
                entidadId: null,
                campo: "RESUMEN",
                valorAnterior: null,
                valorNuevo: `📦 Se importaron ${nuevosProductos.length} productos por carga masiva`,
                accion: "CREAR",
                fechaCambio: new Date()
            });

            return {
                message: `✅ Se crearon ${nuevosProductos.length} productos nuevos`,
                productosCreados: nuevosProductos.map(p => p.codigoCliente),
                productosNoEncontrados: noEncontrados,
            };

        } catch (error) {
            console.error("❌ Error en editBulk:", error); // LOG AL TERMINAL
            console.log(error)
            throw error;
        }
    }

    static async editBulk(filePath) {
        try {
            const workbook = xlsx.readFile(filePath);
            const sheet = workbook.SheetNames[0];
            const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet]);

            const productosActualizados = [];

            for (const row of data) {
                const { codigoSAP, estado } = row;

                if (!codigoSAP || !estado) continue;

                const codigoStr = String(codigoSAP).trim(); // 🔥 Conversión clave


                const producto = await ProductosClientes.findOne({ where: { codigoSAP: codigoStr } });
                console.log("Producto encontrado:", producto); // LOG AL TERMINAL

                if (producto) {
                    producto.estado = estado;
                    await ProductosClientes.save({ usuarioId });
                    productosActualizados.push(codigoSAP);
                }
            }

            return {
                message: `Se actualizaron ${productosActualizados.length} productos`,
                productos: productosActualizados,
            };
        } catch (error) {
            console.error("❌ Error en editBulk:", error); // LOG AL TERMINAL
            throw error;
        }
    }

    static async listProducts(filtros, page = 1, limit = 8, id) {

        const { estado, categoria, unidadNegocio, busqueda } = filtros;

        const estadoNorm = (estado || "").toString().trim().toLowerCase();

        const includeWhere = {};
        if (estadoNorm === "activo") {
            includeWhere.estado_vigente = "activo";
        } else if (estadoNorm === "inactivo") {
            includeWhere.estado_vigente = { [Op.ne]: "activo" };
        }
        if (categoria) includeWhere.categoria = categoria;
        if (unidadNegocio) includeWhere.unidadNegocio = unidadNegocio;
        // if (busqueda) {
        //     includeWhere[Op.or] = [
        //         { producto: { [Op.like]: `%${busqueda}%` } },
        //         { codigoSAP: { [Op.like]: `%${busqueda}%` } }
        //     ];
        // }

        const offset = (page - 1) * limit;

        const where = {};
        if (id) where.clienteId = id;
        // 🔎 OR global: codigoCliente || producto.producto || producto.codigoSAP
        if (busqueda) {
            const pattern = `%${busqueda}%`;
            where[Op.or] = [
                { codigoCliente: { [Op.like]: pattern } },
                { '$producto.producto$': { [Op.like]: pattern } },
                { '$producto.codigoSAP$': { [Op.like]: pattern } },
            ];
        }



        try {
            const { count, rows } = await ProductosClientes.findAndCountAll({
                where,
                include: [{
                    model: Productos,
                    as: 'producto',
                    attributes: ['producto', 'codigoSAP', 'categoria', 'SalesOrg', 'estado', 'estado_vigente'],
                    where: includeWhere,
                    required: true,
                }],
                limit,
                offset,
                order: [[{ model: Productos, as: 'producto' }, 'producto', 'ASC']],
                distinct: true,
                col: 'id',
                subQuery: false,               // <- hace que $producto.campo$ funcione en WHERE raíz
                // logging: console.log,       // <- activa para ver el SQL y confirmar filtros
            });

            // Contadores de activos e inactivos (solo con clienteId si existe)
            const whereTotales = {};
            if (id) whereTotales.clienteId = id;

            const totalActivos = await ProductosClientes.count({
                where: whereTotales,
                include: [
                    {
                        model: Productos,
                        as: "producto",
                        where: { estado_vigente: "activo" },
                    },
                ],
            });

            const totalInactivos = await ProductosClientes.count({
                where: whereTotales,
                include: [
                    {
                        model: Productos,
                        as: "producto",
                        where: { estado_vigente: { [Op.ne]: "activo" } },
                    },
                ],
            });

            return {
                total: count,
                paginas: Math.ceil(count / limit),
                paginaActual: page,
                productos: rows,
                resumen: {
                    activos: totalActivos,
                    inactivos: totalInactivos
                }
            };
        } catch (error) {
            console.log(error)
            throw error;
        }
    }

    static async postOne(data, usuarioId) {
        try {
            const result = await ProductosClientes.create(data, { usuarioId });
            return result;
        } catch (error) {
            console.log(error)
            throw error;
        }
    }

    static async update(data, id, usuarioId) {
        try {
            const result = await ProductosClientes.update(data, {
                where: {
                    id: id
                },
                individualHooks: true,
                usuarioId,
            });
            return result;
        } catch (error) {
            console.log(error)
            throw error;
        }
    }
}

module.exports = ProductosServices;
