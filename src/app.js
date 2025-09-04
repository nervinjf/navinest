const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const db = require("./utils/database");
const handleError = require("./middlewares/error.middleware");
const initModels = require("./models/initModels");
const { UsersRoutes, authRoutes, ProductosRoutes, ProductosClientesRoutes, ClientesRoutes, PedidosRoutes, AuditoriaRoutes, ArchivosRoutes, ProductosMesesRoutes, EmailAllowRoutes } = require("./routes");
const transporter = require("./utils/mailer");
const moment = require("moment");
require("moment-timezone");
moment.locale('es-VE');
moment.tz.setDefault("America/Caracas");
const iniciarLimpiezaOTP = require("./cron/otpCleaner");
require("./cron/estadoMensual.cron");

require("./services/correoListener.services"); // ✅ Esto lo mantiene corriendo en background


console.log("Zona horaria actual:", moment.tz.guess());

const app = express();

// const ALLOWED_ORIGINS = new Set([
//   "http://localhost:5173",
//   "http://127.0.0.1:5173",
//   "https://pedidosnavy.nebconnection.com",
// ]);

app.use(express.json());
app.set('trust proxy', true);
app.use(
  morgan('combined', {
    stream: process.stdout,
    skip: (req) => req.path === '/healthz', // evita ruido del health
  })
);

// var corsOptions = {
//   origin: 'https://pedidosnavy.nebconnection.com',
//   optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
// }

var corsOptions = {
  origin: 'http://localhost:5173',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}


app.use(cors(corsOptions));
// app.use(cors());



initModels();

db.authenticate()
  .then(() => console.log("Autenticación exitosa"))
  .catch((error) => console.log(error));

db.sync()
  .then(() => console.log("Base de datos sincronizada"))
  .catch((error) => console.log(error));

transporter
  .verify() // devuelve una promesa
  .then(() =>
    console.log("Estamos listos para enviar correos a diestra y siniestra")
  );

  // app.get("/", (req, res) => {
  //   const mensaje = "Hola, este es un mensaje de prueba";
  //   res.send("¡Hola Mundo!");
  // });

  // Webhook Event Grid
app.use('/webhooks', require('./webhooks/eventgrid.storage'));

app.use((req, _res, next) => { 
  console.log('➡️', req.method, req.originalUrl); 
  next(); 
});

// Healthcheck opcional
app.get('/healthz', (_req, res) => {
  res.status(200).send('OK');
});

app.use("/api/v1", UsersRoutes);
app.use("/api/v1", authRoutes);
app.use("/api/v1", ProductosRoutes);
app.use("/api/v1", ProductosClientesRoutes);
app.use("/api/v1", ClientesRoutes);
app.use("/api/v1", PedidosRoutes);
app.use("/api/v1", AuditoriaRoutes);
app.use("/api/v1", ArchivosRoutes);
app.use("/api/v1", ProductosMesesRoutes);
app.use("/api/v1", EmailAllowRoutes);
app.use("/api/v1/report", require("./routes/report.routes"));
app.use("/api/v1/report", require("./routes/report.failed.routes"));
app.use("/api/v1/report", require("./routes/report.retry.routes"));


app.get('/', (req, res) => {
  res.json({ mensaje: "Hola mundo desde Navy" });
});

iniciarLimpiezaOTP();



app.use(handleError);

module.exports = app;
