const { Op, Sequelize } = require('sequelize');
const { Productos, Auditoria } = require('../models');
const xlsx = require("xlsx");
const ProductosMesesService = require('./productosMeses.services');

class ProductosServices {
    static async bulkCreate(filePath, usuarioId) {
        try {

            const workbook = xlsx.readFile(filePath);
            const sheet = workbook.SheetNames[0];
            const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet]);

            const nuevosProductos = [];

            for (const row of data) {
                const {
                    codigoSAP,
                    producto,
                    categoria,
                    unidadNegocio,
                    uniPorDisplay,
                    displaysPorBulto,
                    unidadesPorBulto,
                    codigoBarraUV,
                    estado,
                    SalesOrg
                } = row;

                // Verifica campos obligatorios
                if (!codigoSAP || !producto || !estado || !uniPorDisplay || !displaysPorBulto || !unidadesPorBulto || !SalesOrg) continue;

                const codigoStr = String(codigoSAP).trim();


                // Verificar si ya existe
                const existe = await Productos.findOne({ where: { codigoSAP: codigoStr } });
                if (existe) continue;

                nuevosProductos.push({
                    codigoSAP: codigoStr,
                    producto: String(producto).trim(),
                    categoria: categoria?.trim() || null,
                    unidadNegocio: unidadNegocio?.trim() || null,
                    estado: estado.trim().toLowerCase(),
                    uniPorDisplay: parseInt(uniPorDisplay) || 0,
                    displaysPorBulto: parseInt(displaysPorBulto) || 0,
                    unidadesPorBulto: parseInt(unidadesPorBulto) || 0,
                    codigoBarraUV: codigoBarraUV || null,
                    SalesOrg: String(SalesOrg).trim() || null
                });
            }


            if (nuevosProductos.length > 0) {
                await Productos.bulkCreate(nuevosProductos, {
                    ignoreDuplicates: true,
                    usuarioId, // se pasa a los hooks
                    esBulk: true, // 🟡 Añadimos esta bandera
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
                productos: nuevosProductos.map(p => p.codigoSAP),
            };

        } catch (error) {
            console.error("❌ Error en editBulk:", error); // LOG AL TERMINAL
            console.log(error)
            throw error;
        }
    }

    static async editBulk(filePath, usuarioId) {
        try {
            const workbook = xlsx.readFile(filePath);
            const sheet = workbook.SheetNames[0];
            const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet]);

            const productosActualizados = [];

            for (const row of data) {
                const { codigoSAP, estado } = row;

                if (!codigoSAP || !estado) continue;

                const codigoStr = String(codigoSAP).trim(); // 🔥 Conversión clave


                const producto = await Productos.findOne({ where: { codigoSAP: codigoStr } });

                if (producto) {
                    producto.estado = estado;
                    await producto.save({ usuarioId });
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

    static async listProducts(filtros, page = 1, limit = 8) {

        const { estado, categoria, unidadNegocio, busqueda } = filtros;
        const where = {};
        if (estado) where.estado = estado;
        if (categoria) where.categoria = categoria;
        if (unidadNegocio) where.unidadNegocio = unidadNegocio;
        if (busqueda) {
            where[Op.or] = [
                {
                    producto: {
                        [Op.like]: `%${busqueda.replace(/[%_]/g, "\\$&")}%`
                    }
                },
                {
                    codigoSAP: {
                        [Op.like]: `%${busqueda.replace(/[%_]/g, "\\$&")}%`
                    }
                }
            ];
        }

        const offset = (page - 1) * limit;


        try {

            const categorias = await Productos.findAll({
                attributes: [
                    [Sequelize.fn('DISTINCT', Sequelize.col('categoria')), 'categoria'],
                ],
                order: [['categoria', 'ASC']],
            });

            const lista = categorias.map((c) => c.get('categoria')).filter(Boolean); // eliminamos nulos si hay

            const { count, rows } = await Productos.findAndCountAll({
                where,
                limit,
                offset,
                order: [["producto", "ASC"]],
            });

            return {
                total: count,
                paginas: Math.ceil(count / limit),
                paginaActual: page,
                productos: rows,
                Categorias: lista
            };
        } catch (error) {
            console.log(error)
            throw error;
        }
    }

    static async postOne(data, usuarioId) {
        try {
            const result = await Productos.create(data, { usuarioId });
            return result;
        } catch (error) {
            throw error;
        }
    }

    static async update(data, id, usuarioId) {
        const t = await Productos.sequelize.transaction();
        try {
            const producto = await Productos.findByPk(id, { transaction: t });
            if (!producto) throw new Error("Producto no encontrado");

            await producto.update(data, {
                transaction: t,
                individualHooks: true,
                usuarioId,
            });

            // Si el payload trae 'estado' y NO es 'activo_meses', limpiamos meses
            if (Object.prototype.hasOwnProperty.call(data, "estado") &&
                data.estado !== "activo_meses") {
                await ProductosMesesService.limpiarMeses(id, t);
            }

            await t.commit();
            return producto; // devuelve el producto actualizado
        } catch (error) {
            console.log(error)
            throw error;
        }
    }

    static async searchProducts(q) {
        try {

            const whereClause = q
                ? {
                    [Op.or]: [
                        { producto: { [Op.like]: `%${q}%` } },
                        { codigoSAP: { [Op.like]: `%${q}%` } }
                    ]
                }
                : {};

            const productos = await Productos.findAll({
                attributes: ["id", "producto", "codigoSAP"],
                where: whereClause,
                order: [["producto", "ASC"]],
                limit: 20
            });

            return productos;
        } catch (error) {
            console.log(error)
            throw error
        }
    }



}

module.exports = ProductosServices;