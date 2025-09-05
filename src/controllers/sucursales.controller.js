const fs = require("fs");
const { SucursalesServices } = require("../services");

const CreateBulkBranches = async (req, res, next) => {
  try {
    const filePath = req.file?.path;
    if (!filePath) return res.status(400).json({ message: "No se subió ningún archivo" });

    const usuarioId = req.user?.id || 1;
    const result = await SucursalesServices.bulkCreate(filePath, usuarioId);

    // limpia el archivo temporal
    try { fs.unlinkSync(filePath); } catch (_) {}
    res.json(result);
  } catch (error) {
    next({ status: 500, errorContent: error, message: "Error en carga masiva de sucursales" });
  }
};

const EditBulkBranches = async (req, res, next) => {
  try {
    const filePath = req.file?.path;
    if (!filePath) return res.status(400).json({ message: "No se subió ningún archivo" });

    const usuarioId = req.user?.id || 1;
    const result = await SucursalesServices.editBulk(filePath, usuarioId);

    try { fs.unlinkSync(filePath); } catch (_) {}
    res.json(result);
  } catch (error) {
    next({ status: 500, errorContent: error, message: "Error al editar sucursales (bulk)" });
  }
};

const ListBranches = async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;

    const filtros = {
      busqueda: req.query.busqueda?.trim() || null,   // nombre, código, dirección
      estado: req.query.estado?.trim() || null,       // activo/inactivo
      ciudad: req.query.ciudad?.trim() || null,
      tipo: req.query.tipo?.trim() || null,           // retail, farmacia, mayorista, etc.
      salesOrg: req.query.salesOrg?.trim() || null,
    };

    const result = await SucursalesServices.listBranches(filtros, page, limit);
    res.json(result);
  } catch (error) {
    next({ status: 400, errorContent: error, message: "Error al listar sucursales" });
  }
};

const CreateBranch = async (req, res, next) => {
  try {
    const data = req.body;
    const usuarioId = req.user?.id || 0;
    const result = await SucursalesServices.postOne(data, usuarioId);
    res.json(result);
  } catch (error) {
    next({ status: 400, errorContent: error, message: "Error al crear sucursal" });
  }
};

const UpdateBranch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const usuarioId = req.user?.id || 1;
    const result = await SucursalesServices.update(data, id, usuarioId);
    res.json(result);
  } catch (error) {
    next({ status: 400, errorContent: error, message: "Error al actualizar sucursal" });
  }
};

const SearchBranch = async (req, res, next) => {
  try {
    const { q } = req.query;
    const result = await SucursalesServices.searchBranches(q);
    res.json(result);
  } catch (error) {
    next({ status: 400, errorContent: error, message: "Error en búsqueda de sucursales" });
  }
};

module.exports = {
  CreateBulkBranches,
  EditBulkBranches,
  ListBranches,
  CreateBranch,
  UpdateBranch,
  SearchBranch,
};
