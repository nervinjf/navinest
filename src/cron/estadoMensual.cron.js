// cron/estadoMensual.cron.js
const cron = require("node-cron");
const { syncEstadoMensualSoloRegulados } = require("../services/estadoMensual.services");

// El 1 de cada mes a las 00:10
cron.schedule("0 1 1 * *", async () => {
  try {
    const r = await syncEstadoMensualSoloRegulados(null);
    console.log("⏰ Sync estado mensual (solo regulados):", r);
  } catch (e) {
    console.error("❌ Cron estado mensual:", e.message);
  }
});
