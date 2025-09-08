const cron = require("node-cron");
const { Op } = require("sequelize");
const TemporaryUser = require("../models/userTemporary.models");
const moment = require("moment");

const iniciarLimpiezaOTP = () => {
  // Ejecutar cada minuto
  cron.schedule("* * * * *", async () => {
    try {
      const haceDosMinutos = moment().subtract(10, "minutes").toDate();

      const eliminados = await TemporaryUser.destroy({
        where: {
          horaotp: {
            [Op.lt]: haceDosMinutos,
          },
        },
      });

      if (eliminados > 0) {
        console.log(`[CRON] 🧹 Se eliminaron ${eliminados} usuarios temporales con OTP expirado`);
      }
    } catch (error) {
      console.error("[CRON] ❌ Error limpiando OTPs expirados:", error);
    }
  });
};

module.exports = iniciarLimpiezaOTP;
