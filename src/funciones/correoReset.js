const { transporter } = require("../utils/mailer");

module.exports = function resetPassrwor(email, link){
    
    transporter.sendMail({
        from: "<noreply@neb.com.ve>",
        to: email,
        subject: `Código de verificación`,
        text: link
    });
}