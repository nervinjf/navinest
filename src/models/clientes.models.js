const db = require("../utils/database");
const { DataTypes } = require("sequelize");
const Auditoria = require("./auditoria.models");

const Clientes = db.define('clientes', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
    },
    nombre: {
        type: DataTypes.STRING(250),
        allowNull: false,
    },
    requiere_conversion: {
        type: DataTypes.BOOLEAN, 
        defaultValue: false
    },
    conversion: {
        type: DataTypes.STRING(250),
        defaultValue: null
    },
    status: {
        type: DataTypes.BOOLEAN(50),
        defaultValue: false
    },
    codigo: {
        type: DataTypes.STRING(250),
        allowNull: false,
        defaultValue: 0
    }
}, {
    hooks: {
        async afterCreate(cliente, options) {
            await Auditoria.create({
                user_id: options.usuarioId,
                modulo: "clientes",
                entidadId: cliente.id, // aún no se ha generado el ID
                campo: "TODOS",
                valorAnterior: null,
                valorNuevo: JSON.stringify(cliente.dataValues),
                accion: "CREAR"
            });
        },

        async beforeUpdate(cliente, options) {
            const cambios = [];
            const viejo = cliente._previousDataValues;
            const nuevo = cliente.dataValues;
            console.log(options)

            for (const campo in nuevo) {
                if (
                    nuevo[campo] !== viejo[campo] &&
                    campo !== "updatedAt" &&
                    campo !== "createdAt"
                ) {
                    cambios.push({
                        user_id: 1,
                        modulo: "clientes",
                        entidadId: cliente.id,
                        campo,
                        valorAnterior: viejo[campo],
                        valorNuevo: nuevo[campo],
                        accion: "ACTUALIZAR"
                    });
                }
            }

            if (cambios.length > 0) {
                await Auditoria.bulkCreate(cambios);
            }
        },

        async beforeDestroy(cliente, options) {
            await Auditoria.create({
                user_id: options.usuarioId || null,
                modulo: "clientes",
                entidadId: cliente.id,
                campo: "TODOS",
                valorAnterior: JSON.stringify(cliente.dataValues),
                valorNuevo: null,
                accion: "ELIMINAR"
            });
        }
    }
});


module.exports = Clientes;