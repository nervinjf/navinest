// const app = require('./app');
// const fs = require('fs');
// require('dotenv').config();

// const PORT = process.env.PORT || 8000;

// app.listen(PORT, '0.0.0.0', () => {
//   console.log(`servidor corriendo en el puerto ${PORT}`);
// });


// src/server.js
require('dotenv').config();

const path = require('path');
const express = require('express');
const app = require('./app');
const sequelize = require('./utils/database');

const PORT = process.env.PORT || 8080;

// (opcional) servir /public si lo usas
app.use(express.static(path.join(__dirname, 'public')));

// En App Service el TLS lo gestiona Azure: NO crees https.createServer aquí.
(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos OK');

    // En prod no conviene alter:true; hazlo solo si lo controlas por variable
    if (process.env.DB_SYNC === 'true') {
      await sequelize.sync({ alter: true });
      console.log('🛠️ sync(alter) ejecutado');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server HTTP escuchando en puerto ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Error al iniciar:', err);
    // Haz que el proceso falle para que Azure lo reinicie y puedas ver logs
    process.exit(1);
  }
})();
