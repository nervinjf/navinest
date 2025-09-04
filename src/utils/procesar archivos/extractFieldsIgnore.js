const { ProductosClientes, Clientes, Productos } = require("../../models");
const { Op } = require("sequelize");

async function obtenerCodigoDesdeDB(codigo) {
    try {
        const producto = await ProductosClientes.findOne({
            where: {
                codigoCliente: {
                    [Op.like]: `%${codigo}%` // Búsqueda insensible a mayúsculas/minúsculas (PostgreSQL)
                }
            },
            include: [
                {
                    model: Productos,
                    as: 'producto'
                },
                {
                    model: Clientes,
                    as: 'cliente'
                }
            ]
        });

        return producto || null;
    } catch (e) {
        return null;
    }
}

async function extractFieldsIgnore(fields, ignorarProductos = []) {
    const extractedData = {};
    const productosNoEncontrados = [];
    const codigosInactivos = ["Inactivar", "Inactivo", "Inactivo In & Out"];
    for (const key in fields) {
        const field = fields[key];

        if (field?.valueString) {
            extractedData[key] = { valueString: field.valueString };
        }

        if (field?.type === "array" && field.valueArray?.length) {
            const lista = [];

            for (const item of field.valueArray) {
                if (item.type === "object" && item.valueObject) {
                    let objectData = {};

                    for (const subKey in item.valueObject) {
                        if (item.valueObject[subKey]?.valueString) {
                            objectData[subKey] = item.valueObject[subKey].valueString;
                        }
                    }


                    if (objectData.Description) {

                        if (ignorarProductos.includes(objectData.Material)) {
                            console.log(`⏩ Ignorando producto: ${objectData.Material}`);
                            continue;
                        }
                        const codigoCorrecto = await obtenerCodigoDesdeDB(objectData.Material);
                        if (codigoCorrecto &&
                            !codigosInactivos.includes(codigoCorrecto.producto.estado.trim())) {
                            objectData.Material = codigoCorrecto.producto.codigoSAP;
                            if (codigoCorrecto.cliente.requiere_conversion == true) {
                                objectData.Cantidad = objectData.Cantidad / codigoCorrecto.producto.unidadesPorBulto;
                            }
                            objectData.NumeroFactura = fields["N Factura"]?.valueString || "SIN_FACTURA";

                            const salesOrg = codigoCorrecto?.producto?.SalesOrg || "";

                            const mapping = {
                                "AlimentosyBebidas": "- A&B",
                                "Purina": "- NPP",
                                "Confites": "- C",
                                "Professional": "- Prof"
                            };

                            for (const key in mapping) {
                                if (salesOrg.includes(key)) {
                                    objectData.cust = fields["N Factura"]?.valueString + " " + mapping[key];
                                    break;
                                }
                            }

                            objectData.sales = codigoCorrecto.producto.SalesOrg;
                            lista.push(objectData); // ✅ Solo agregamos si encontró el código
                        } else if (
                            objectData.Material &&
                            objectData.Description &&
                            objectData.Material.toUpperCase() !== "CODIGO" &&
                            objectData.Material.toUpperCase() !== "CÓDIGO PRODUCTO"
                        ) {
                            productosNoEncontrados.push({
                                material: objectData.Material,
                                descripcion: objectData.Description,
                                codigo: codigoCorrecto || "No encontrado",
                            });
                        }
                    } else {
                        console.log("⚠ No se encontró descripción en el objeto.");
                    }
                }
            }
            extractedData[key] = lista;
        }
    }
    return { extractedData, productosNoEncontrados };
}

module.exports = { extractFieldsIgnore };
