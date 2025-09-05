const { AuthServices } = require("../services");
const resetPassrwor = require('../funciones/correoReset');
const linkReset = require('../templates/linkResetPassword');
const transporter = require("../utils/mailer");

const userLogin = async (req, res, next) => {
  try {
    // email y password
    const credentials = req.body;
    const result = await AuthServices.authenticate(credentials);
    // false --> no era contraseña invalida
    // null --> no se encuentra al usuario
    // { isValid, result }
    if (result) {
      const { nombre, correo, id, rol } = result.result;
      const user = { nombre, correo, id, rol };
      // console.log(user)
      const token = AuthServices.genToken(user);
      user.token = token;
       res.json({
        success: true,
        user,
      });
      console.log({ ...user })
    } else {
      res.status(400).json({ message: "Información inválida" });
    }
  } catch (error) {
    next({
      status: 400,
      errorContent: error,
      message: "Email o contraseña inválida",
    });
  }
};

const resetEmail = async (req, res, next) => {
  try {

    const userId = req.body.id;
    const newPassword = req.body.password;

    const result = await AuthServices.resetpass(newPassword, userId);

    res.status(201).json(result);
  } catch (error) {
    next({
      status: 500,
      errorContent: error,
      message: "No se pudo generar el correo",
    })
  }
}

const validateTokenReset = async (req, res, next) => {
  try {

    const token = req.query.token;
    const result = await AuthServices.validatetoken(token);
    res.json(result)
  } catch (error) {
    next({
      status: 400,
      errorContent: error,
      message: "Se expiro el token",
    })
  }
}

const forgotPassword = async (req, res, next) => {
  try {
    const email = req.body;

    const result = await AuthServices.forgot(email);

    try {
      await transporter.sendMail({
        from: "<dpn.navi@nebconnection.com>",
        to: result.correo,
        subject: `Código de verificación`,
        html: linkReset(result.link, result.nombre, result.apellido)
      });

      res.status(200).json({ message: 'Correo electrónico enviado con éxito' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error al enviar el correo electrónico' });
    }



    console.log(respuesta);

  } catch (error) {
    next({
      status: 500,
      errorContent: error,
      message: "No se pudo generar el correo",
    })
  }
}

module.exports = {
  userLogin,
  forgotPassword,
  resetEmail,
  validateTokenReset
};
