const { Op, Sequelize } = require("sequelize");
const xlsx = require("xlsx");

// Asegúrate de exportar Sucursales y Auditoria desde ../models/index.js
const { Sucursales, Auditoria } = require("../models");

function sanitizeLike(text = "") {
  return text.replace(/[%_]/g, "\\$&");
}

class SucursalesServices {
  /**
   * Carga masiva desde Excel.
   * Columnas esperadas (ajústalas a tu archivo):
   *  - codigo (único), nombre, tipo, estado, direccion, ciudad, estadoRegion, telefono, email,
   *    lat, lng, salesOrg
   */
  static async bulkCreate(filePath, usuarioId) {
    try {
      const wb = xlsx.readFile(filePath);
      const sheet = wb.SheetNames[0];
      const data = xlsx.utils.sheet_to_json(wb.Sheets[sheet]);

      const nuevas = [];

      for (const row of data) {
        const {
          codigo,
          nombre,
          tipo,
          estado,
          direccion,
          ciudad,
          estadoRegion,
          telefono,
          email,
          lat,
          lng,
          salesOrg,
        } = row;

        if (!codigo || !nombre) continue;

        const codigoStr = String(codigo).trim();

        const existe = await Sucursales.findOne({ where: { codigo: codigoStr } });
        if (existe) continue;

        nuevas.push({
          codigo: codigoStr,
          nombre: String(nombre).trim(),
          tipo: tipo?.trim() || null,
          estado: (estado ?? "activo").toString().trim().toLowerCase(),
          direccion: direccion?.toString().trim() || null,
          ciudad: ciudad?.toString().trim() || null,
          estadoRegion: estadoRegion?.toString().trim() || null,
          telefono: telefono?.toString().trim() || null,
          email: email?.toString().trim() || null,
          lat: lat ? Number(lat) : null,
          lng: lng ? Number(lng) : null,
          salesOrg: salesOrg?.toString().trim() || null,
        });
      }

      if (nuevas.length > 0) {
        await Sucursales.bulkCreate(nuevas, {
          ignoreDuplicates: true,
          usuarioId,   // <- si usas hooks para auditoría
          esBulk: true,
        });
      }

      await Auditoria.create({
        user_id: usuarioId,
        modulo: "sucursales",
        entidadId: null,
        campo: "RESUMEN",
        valorAnterior: null,
        valorNuevo: `🏬 Se importaron ${nuevas.length} sucursales por carga masiva`,
        accion: "CREAR",
        fechaCambio: new Date(),
      });

      return {
        message: `✅ Se crearon ${nuevas.length} sucursales nuevas`,
        sucursales: nuevas.map(s => s.codigo),
      };
    } catch (error) {
      console.error("❌ Error en bulkCreate Sucursales:", error);
      throw error;
    }
  }

  /**
   * Edición masiva: típicamente actualizar estado, tipo, dirección, etc.
   * Requiere columna 'codigo' para hacer match.
   */
  static async editBulk(filePath, usuarioId) {
    try {
      const wb = xlsx.readFile(filePath);
      const sheet = wb.SheetNames[0];
      const data = xlsx.utils.sheet_to_json(wb.Sheets[sheet]);

      const actualizadas = [];

      for (const row of data) {
        const { codigo, estado, tipo, direccion, ciudad, estadoRegion, telefono, email, lat, lng, salesOrg, nombre } = row;
        if (!codigo) continue;

        const codigoStr = String(codigo).trim();
        const suc = await Sucursales.findOne({ where: { codigo: codigoStr } });
        if (!suc) continue;

        // Solo actualiza campos presentes
        const patch = {};
        if (nombre !== undefined)       patch.nombre = String(nombre).trim();
        if (estado !== undefined)       patch.estado = String(estado).trim().toLowerCase();
        if (tipo !== undefined)         patch.tipo = tipo?.toString().trim() || null;
        if (direccion !== undefined)    patch.direccion = direccion?.toString().trim() || null;
        if (ciudad !== undefined)       patch.ciudad = ciudad?.toString().trim() || null;
        if (estadoRegion !== undefined) patch.estadoRegion = estadoRegion?.toString().trim() || null;
        if (telefono !== undefined)     patch.telefono = telefono?.toString().trim() || null;
        if (email !== undefined)        patch.email = email?.toString().trim() || null;
        if (lat !== undefined)          patch.lat = lat ? Number(lat) : null;
        if (lng !== undefined)          patch.lng = lng ? Number(lng) : null;
        if (salesOrg !== undefined)     patch.salesOrg = salesOrg?.toString().trim() || null;

        await suc.update(patch, { usuarioId, individualHooks: true });
        actualizadas.push(codigoStr);
      }

      return {
        message: `✏️ Se actualizaron ${actualizadas.length} sucursales`,
        sucursales: actualizadas,
      };
    } catch (error) {
      console.error("❌ Error en editBulk Sucursales:", error);
      throw error;
    }
  }

  static async listBranches(filtros, page = 1, limit = 8) {
    const { estado, ciudad, tipo, busqueda, salesOrg } = filtros;

    const where = {};
    if (estado) where.estado = estado;
    if (ciudad) where.ciudad = ciudad;
    if (tipo) where.tipo = tipo;
    if (salesOrg) where.salesOrg = salesOrg;

    if (busqueda) {
      const q = sanitizeLike(busqueda);
      where[Op.or] = [
        { nombre:   { [Op.like]: `%${q}%` } },
        { codigo:   { [Op.like]: `%${q}%` } },
        { direccion:{ [Op.like]: `%${q}%` } },
      ];
    }

    const offset = (page - 1) * limit;

    try {
      // Listas para filt
