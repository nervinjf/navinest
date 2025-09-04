// models/initModels.js
const {
  Productos,
  ProductosClientes,
  Clientes,
  Pedidos,
  DetallePedidos,
  Auditoria,
  Users,
  ProductosMeses,
  Sucursales,
  AzureDailyUsage,      // por si lo necesitas en includes después
  EmailLog,
  IngestionJob,
  // Nuevos / opcionales:
  EmailInbound,
  IngestionAttempt,
  IngestionJobPedido
} = require("./index");

const initModels = () => {
  /** =========================
   *  Catálogo y clientes
   *  ========================= */
  // ProductosClientes <-> Productos / Clientes
  ProductosClientes.belongsTo(Productos, { foreignKey: "producto_id", as: "producto" });
  Productos.hasMany(ProductosClientes,   { foreignKey: "producto_id", as: "productos_clientes" });

  ProductosClientes.belongsTo(Clientes,  { foreignKey: "cliente_id",  as: "cliente" });
  Clientes.hasMany(ProductosClientes,    { foreignKey: "cliente_id",  as: "productos_clientes" });

  // Cliente <-> Sucursales
  Clientes.hasMany(Sucursales, { as: "sucursales", foreignKey: "cliente_id" });
  Sucursales.belongsTo(Clientes, { as: "cliente", foreignKey: "cliente_id" });

  // Productos <-> ProductosMeses (si lo usas para reglas/compras)
  Productos.hasMany(ProductosMeses, { foreignKey: "producto_id", as: "mesesPermitidos" });
  ProductosMeses.belongsTo(Productos, { foreignKey: "producto_id", as: "producto" });

  /** =========================
   *  Pedidos y detalles
   *  ========================= */
  // Cliente <-> Pedido
  Pedidos.belongsTo(Clientes, { foreignKey: "clienteId", as: "cliente", field: 'cliente_id' });
  Clientes.hasMany(Pedidos,   { foreignKey: "clienteId", as: "pedidos", field: 'cliente_id' });

  // Pedido <-> DetallePedidos
  DetallePedidos.belongsTo(Pedidos,  { foreignKey: "pedido_id",  as: "pedido" });
  Pedidos.hasMany(DetallePedidos,    { foreignKey: "pedido_id",  as: "detalles" });

  // Producto <-> DetallePedidos
  DetallePedidos.belongsTo(Productos,{ foreignKey: "producto_id", as: "producto" });
  Productos.hasMany(DetallePedidos,  { foreignKey: "producto_id", as: "detalles" });

  /** =========================
   *  Ingesta (PDFs)
   *  ========================= */
  // Pedido <-> IngestionJob
  IngestionJob.belongsTo(Pedidos, { foreignKey: "pedido_id", as: "pedido" });
  Pedidos.hasMany(IngestionJob,   { foreignKey: "pedido_id", as: "jobs" });

  // (opcional) IngestionJob <-> Cliente (si quieres consultar jobs por cliente)
  IngestionJob.belongsTo(Clientes, { foreignKey: "cliente_id", as: "cliente" });
  Clientes.hasMany(IngestionJob,   { foreignKey: "cliente_id", as: "jobs" });

  // EmailInbound <-> IngestionJob (link por valores: source_id <-> message_id)
  // Nota: no es FK físico; usamos targetKey/sourceKey y desactivamos constraints
  if (EmailInbound) {
  // IngestionJob.sourceId  ->  EmailInbound.messageId
  IngestionJob.belongsTo(EmailInbound, {
    as: "emailInbound",
    foreignKey: "sourceId",   // atributo del modelo IngestionJob
    targetKey: "messageId",   // atributo del modelo EmailInbound
    constraints: false,
  });

  EmailInbound.hasMany(IngestionJob, {
    as: "jobs",
    foreignKey: "sourceId",   // atributo del modelo IngestionJob
    sourceKey: "messageId",   // atributo del modelo EmailInbound
    constraints: false,
  });
}


  // (opcional) IngestionAttempt <-> IngestionJob
  if (IngestionAttempt) {
    IngestionJob.hasMany(IngestionAttempt, { foreignKey: "job_id", as: "attempts" });
    IngestionAttempt.belongsTo(IngestionJob, { foreignKey: "job_id", as: "job" });
  }

  /** =========================
   *  Auditoría / usuarios
   *  ========================= */
  Auditoria.belongsTo(Users, { foreignKey: "user_id", as: "user" });
  Users.hasMany(Auditoria,   { foreignKey: "user_id", as: "auditorias" });


 Pedidos.belongsToMany(IngestionJob, {
  through: 'pedido_ingestion_jobs',
  foreignKey: 'pedido_id',
  otherKey: 'job_id',
  as: 'ingestionJobs',         // ✅ alias 1
});

IngestionJob.belongsToMany(Pedidos, {
  through: 'pedido_ingestion_jobs',
  foreignKey: 'job_id',
  otherKey: 'pedido_id',
  as: 'pedidos',               // ✅ alias 2 (distinto)
});


};

module.exports = initModels;
