const { Users, TemporaryUser } = require('../models');

class UserServices {
    static async create(user) {
        try {
            const result = await Users.create(user)
            return result;
        } catch (error) {
            throw error;
        }
    }

    static async crearTemporal(user) {
        try {
            const result = await TemporaryUser.create(user)
            return result;
        } catch (error) {
            throw error;
        }
    }

    static async deleteEmail(email) {
        try {
            const result = await TemporaryUser.destroy({ where: { correo: email } })
            return result;
        } catch (error) {
            throw error;
        }
    }

    static async getByEmail(email) {
        try {
            // Buscar un usuario por su dirección de correo electrónico
            const user = await TemporaryUser.findOne({ where: { correo: email } });
            return user;
        } catch (error) {
            throw error;
        }
    }

    static async getAll() {
        try {
            const result = await Users.findAll();
            return result;
        } catch (error) {
            throw error;
        }
    }

    static async incrementarIntentos(correo) {
        try {
            const user = await TemporaryUser.findOne({ where: { correo } });
            if (user) {
                user.intentos += 1;
                await user.save();
            }
        } catch (error) {
            throw error;
        }

    };

}

module.exports = UserServices;