const UsersRoutes = require("./users.routes");
const authRoutes = require("./auth.routes");
const ProductosRoutes = require("./productos.routes");
const ProductosClientesRoutes = require("./productosClientes.routes");
const ClientesRoutes = require("./clientes.routes");
const PedidosRoutes = require("./pedidos.routes");
const AuditoriaRoutes = require("./auditoria.routes");
const ArchivosRoutes = require("./descargas.routes");
const ProductosMesesRoutes = require("./productosMeses.routes");
const EmailAllowRoutes = require("./email-allowlist.routes");


module.exports = {
    UsersRoutes,
    authRoutes,
    ProductosRoutes,
    ProductosClientesRoutes,
    ClientesRoutes,
    PedidosRoutes,
    AuditoriaRoutes,
    ArchivosRoutes,
    ProductosMesesRoutes,
    EmailAllowRoutes
};