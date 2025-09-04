// configurar nodemailer para enviar correos con mi cuenta de gmail
const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: "mail.neb.com.ve",
  port: 2525,
  secure: false,
  auth: {
    user: "noreply@neb.com.ve",
    pass: process.env.G_PASSWORD,
  },
  tls: {
    // do not fail on invalid certs
    rejectUnauthorized: false,
  },
});

module.exports = transporter;
