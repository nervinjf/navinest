const { UserServices } = require('../services');
const { generateOTP, sendOTP } = require('../funciones/Otp');

const verifyOTP = async (req, res, next) => {
    try {
        const { correo: email, otp } = req.body;


        // Obtener el usuario con el correo electrónico proporcionado
        let newUser;
        const user = await UserServices.getByEmail(email);
        if (user) {
            const { nombre, apellido, correo, telefono, password, tipoCedula, cedula } = user
            newUser = { nombre, apellido, correo, telefono, password, tipoCedula, cedula };
        }

        // Verificar si el OTP ingresado coincide con el OTP almacenado en la base de datos
        if (user?.otp === otp) {
            const now = new Date();
            const otpTimestamp = new Date(user.horaotp);
            const diffInSeconds = (now - otpTimestamp) / 1000;

            if (diffInSeconds <= 120) {
                // OTP válido
                const result = await UserServices.create(newUser);
                await UserServices.deleteEmail(email);
                res.status(200).send('OTP correcto. Registro permitido.');
            } else {
                await UserServices.deleteEmail(email);
                throw new Error('El OTP ha caducado');
            }
        } else {
            await UserServices.incrementarIntentos(email); // Aquí usamos la nueva función

            if (user.intentos + 1 >= 3) {
                await UserServices.deleteEmail(email);
                throw new Error('Demasiados intentos fallidos. Registro cancelado.');
            } else {
                throw new Error('El OTP ingresado es incorrecto');
            }
        }

    } catch (error) {
        next({
            status: 500,
            errorContent: error,
            message: "Error al verificar OTP"
        })
    }
}

const userRegister = async (req, res, next) => {
    try {
        const newUser = req.body;
        
        // ✅ Lista de dominios permitidos
        const allowedDomains = ["neb.com.ve", "nebconnection.com", "ve.nestle.com"];

        // ✅ Extraer dominio del correo
    const emailDomain = newUser.correo.split("@")[1];

        if (!allowedDomains.includes(emailDomain)) {
      return res.status(400).json({
        message: "Correo inválido. Solo se permiten registros con dominios corporativos autorizados."
      });
    }
        
        const otp = generateOTP(); // Función que genera un OTP aleatorio
        const now = new Date(); // Función que genera un OTP aleatorio
        newUser.otp = otp;
        newUser.horaotp = now;
        await UserServices.crearTemporal(newUser);
        await sendOTP(newUser.correo, otp, newUser.nombre, newUser.apellido); // Función que envía el OTP por correo electrónico
        // const result = await UserServices.create(newUser);
        res.status(200).json({ message: "Se ha enviado el OTP al correo electrónico proporcionado. Por favor, verifique su correo electrónico y complete el registro ingresando el OTP." });
    } catch (error) {
        next({
            status: 400,
            errorContent: error,
            message: "faltan datos",
        })
    }
};

const getAllUsers = async (req, res, next) => {
    try {
        const result = await UserServices.getAll();
        res.json(result);
    } catch (error) {
        next({
            status: 400,
            errorContent: error,
            message: "Algo salio mal"
        })
    }
}

const updateUserRoleAndStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rol, active } = req.body;

    const updatedUser = await UserServices.updateRoleAndStatus(id, { rol, active }, req.user?.id);
    res.json(updatedUser);
  } catch (err) {
    next(err);
  }
};

module.exports = {
    userRegister,
    getAllUsers,
    verifyOTP,
    updateUserRoleAndStatus
}
