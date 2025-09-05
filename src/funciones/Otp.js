// utils/otp.js
const transporter = require('../utils/mailer')
const codigoOTP = require('../templates/CodigoOTP');
const otpGenerator = require("otp-generator");

// Función para generar un OTP aleatorio de 6 dígitos
const generateOTP = () => {
  return otpGenerator.generate(6, {
    digits: true,
    alphabets: false,
    upperCase: false,
    specialChars: false,
  });
};

// Función para enviar el OTP por correo electrónico newUser.correo, otp, newUser.nombre, newUser.apellido
const sendOTP = async (email, otp, nombre, apellido) => {
    // Aquí iría la lógica para enviar el correo electrónico utilizando un servicio de correo electrónico como nodemailer
    // Por ejemplo:
    await transporter.sendMail({
        from: "<dpn.navi@nebconnection.com>",
        to: email,
        subject: `Código de verificación`,
        html: codigoOTP(otp, nombre, apellido),
    });
};

module.exports = { generateOTP, sendOTP };
