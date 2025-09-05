const UserServices = require("./users.services");
const AuthServices = require("./auth.services");
const ProductosServices = require("./productos.services");
const ProductosClientesServices = require("./productosClientes.services");
const ClientesServices = require("./clientes.services");
const PedidosServices = require("./pedidos.services");
const AuditoriaServices = require("./auditoria.services")
const ProductosMesesService = require('./productosMeses.services')
const AllowListServices = require("./email-allowlist.services");
const SucursalesServices  = require("./sucursales.services");

module.exports = {
    UserServices,
    ProductosServices,
    AuthServices,
    ProductosClientesServices,
    ClientesServices,
    PedidosServices,
    AuditoriaServices,
    ProductosMesesService,
    AllowListServices,
    SucursalesServices
};
