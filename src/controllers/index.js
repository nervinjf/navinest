const { userRegister, getAllUsers, verifyOTP } = require("./users.controllers");
const { userLogin, resetEmail, forgotPassword, validateTokenReset } = require("./auth.controllers");
const { CreateBulk, editBulk, ListProducts, createProduct, updateProduct, searchProduct } = require("./productos.controllers");
const { CreateBulkPClientes, editBulkPClientes, ListProductsClientes, createProductClientes, updateProductClientes } = require("./productosClientes.controllers");
const { ListClientes, clienteById, CreateBulkClientes, createCliente, updateCLiente, deleteCLiente } = require("./clientes.controllers");
const { Listpedidos, pedidoById, updatePedidos, deletepedidos, reprocesarPedido } = require("./pedidos.controllers");
const { ListAuditoria } = require("./auditorias.controllers")
const { crearMesActivo, eliminarMesActivo, listarMesesPorProducto } = require('./productosMeses.controllers')
const {  list, create, update, remove, setActive, check } = require("./email-allowlist.controllers");

module.exports = {
    userRegister,
    getAllUsers,
    userLogin,
    validateTokenReset,
    resetEmail,
    forgotPassword,
    verifyOTP,
    CreateBulk,
    editBulk,
    ListProducts,
    createProduct,
    updateProduct,
    ListProductsClientes,
    CreateBulkPClientes,
    editBulkPClientes,
    createProductClientes,
    updateProductClientes,
    ListClientes,
    clienteById,
    CreateBulkClientes,
    createCliente,
    updateCLiente,
    deleteCLiente,
    Listpedidos, pedidoById, updatePedidos, deletepedidos,
    reprocesarPedido,
    searchProduct,
    ListAuditoria,
    crearMesActivo, eliminarMesActivo, listarMesesPorProducto,
    list, create, update, remove, setActive, check

};