const Users = require("./users.models");
const TemporaryUser = require('./userTemporary.models')
const Clientes = require('./clientes.models');
const ProductosClientes = require('./productosClientes.models');
const DetallePedidos = require('./detallePedidos.models');
const Pedidos = require('./pedidos.models');
const Productos = require('./productos.models');
const Auditoria = require('./auditoria.models');
const ProductosMeses = require('./productos_meses.models');
const Sucursales = require('./sucursales.models');
const IngestionAttempt = require("./IngestionAttempt.models");
const EmailInbound = require("./EmailInbound.models");
const IngestionJob = require("./IngestionJob.models");
const EmailLog = require("./EmailLog.models");
const AzureDailyUsage = require("./AzureDailyUsage.models");
const IngestionJobPedido = require("./IngestionJobPedido.models");
const EmailAllowlist = require("./EmailAllowlist.models");

module.exports={
    Users,
    TemporaryUser,
    Clientes,
    ProductosClientes,
    DetallePedidos,
    Pedidos,
    Productos,
    ProductosClientes,
    Auditoria,
    ProductosMeses,
    Sucursales,
    IngestionAttempt,
    EmailInbound,
    IngestionJob,
    EmailLog,
    AzureDailyUsage,
    IngestionJobPedido,
    EmailAllowlist
};