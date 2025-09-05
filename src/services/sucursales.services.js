const { Op, Sequelize } = require("sequelize");
const xlsx = require("xlsx");
const { Sucursales } = require("../models"); // asegura export en models/index.js

function sanitizeLike(text = "") {
  return text.replace(/[%_]/g, "\\$&");
}

class SucursalesServices {
  /**
   * BULK CREATE desde Excel.
   * Columnas esperadas (ajústalas a tu archivo):
   * - clienteId (num), codigo (str), sucursal (str), categoria (str opcional)
   * UNIQUE compuesto: (cliente_id, codigo)
   */
  static async bulkCreate(filePath, usuarioId) {
    const wb = xlsx.readFile(filePath);
    const sheet = wb.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(wb.Sheets[sheet], { defval: null });

    let creadas = 0;
    const omitidas = [];
    const procesadas = [];

    for (const row of data) {
      const clienteId = row.clienteId != null ? Number(row.clienteId) : null;
      const codigo    = row.codigo != null ? String(row.codigo).trim() : null;
      const nombre    = row.sucursal != null ? String(row.sucursal).trim() : null;
      const categoria = row.categoria != null ? String(row.categoria).trim() : null;

      if (!clienteId || !codigo || !nombre) {
        omitidas.push({ clienteId, codigo, sucursal: nombre, motivo: "Faltan campos obligatorios" });
        continue;
      }

      // respeta UNIQUE (cliente_id, codigo)
      const existe = await Sucursales.findOne({ where: { clienteId, codigo } });
      if (existe) {
        omitidas.push({ clienteId, codigo, sucursal: nombre, motivo: "Duplicada (clienteId+codigo)" });
        continue;
      }

      await Sucursales.create(
        { clienteId, codigo, sucursal: nombre, categoria },
        { usuarioId }
      );

      creadas += 1;
      procesadas.push(`${clienteId}:${codigo}`);
    }

    return {
      message: `✅ Se crearon ${creadas} sucursales`,
      creadas,
      omitidas,
      procesadas,
    };
  }

  /**
   * BULK UPDATE desde Excel.
   * Requiere: clienteId + codigo para ubicar registro.
   * Campos actualizables: sucursal, categoria (y opcionalmente codigo si deseas permitirlo).
   */
  static async editBulk(filePath, usuarioId) {
    const wb = xlsx.readFile(filePath);
    const sheet = wb.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(wb.Sheets[sheet], { defval: null });

    let actualizadas = 0;
    const noEncontradas = [];
    const procesadas = [];

    for (const row of data) {
      const clienteId = row.clienteId != null ? Number(row.clienteId) : null;
      const codigo    = row.codigo != null ? String(row.codigo).trim() : null;

      if (!clienteId || !codigo) {
        noEncontradas.push({ clienteId, codigo, motivo: "Faltan clienteId o codigo" });
        continue;
      }

      const suc = await Sucursales.findOne({ where: { clienteId, codigo } });
      if (!suc) {
        noEncontradas.push({ clienteId, codigo, motivo: "No existe (clienteId+codigo)" });
        continue;
      }

      const patch = {};
      if (row.sucursal !== undefined && row.sucursal !== null) {
        patch.sucursal = String(row.sucursal).trim();
      }
      if (row.categoria !== undefined) {
        patch.categoria = row.categoria === null ? null : String(row.categoria).trim();
      }
      // Si deseas permitir cambio de código (cuidando UNIQUE), descomenta:
      // if (row.nuevoCodigo) patch.codigo = String(row.nuevoCodigo).trim();

      await suc.update(patch, { usuarioId, individualHooks: true });
      actualizadas += 1;
      procesadas.push(`${clienteId}:${codigo}`);
    }

    return {
      message: `✏️ Se actualizaron ${actualizadas} sucursales`,
      actualizadas,
      noEncontradas,
      procesadas,
    };
  }

  /**
   * Listado con filtros + paginación.
   * Filtros: clienteId, categoria, busqueda (en sucursal y codigo)
   */
  static async listBranches(filtros, page = 1, limit = 8) {
    const { clienteId, categoria, busqueda } = filtros;

    const where = {};
    if (clienteId) where.clienteId = clienteId;
    if (categoria) where.categoria = categoria;

    if (busqueda) {
      const q = sanitizeLike(busqueda);
      where[Op.or] = [
        { sucursal: { [Op.like]: `%${q}%` } },
        { codigo:   { [Op.like]: `%${q}%` } },
      ];
    }

    const offset = (page - 1) * limit;

    // Filtros disponibles (categorías) para combos
    const categorias = await Sucursales.findAll({
      attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("categoria")), "categoria"]],
      where: clienteId ? { clienteId } : {},
      order: [["categoria", "ASC"]],
    });
    const listaCategorias = categorias.map(c => c.get("categoria")).filter(Boolean);

    const { count, rows } = await Sucursales.findAndCountAll({
      where,
      limit,
      offset,
      order: [["sucursal", "ASC"]],
    });

    return {
      total: count,
      paginas: Math.ceil(count / limit),
      paginaActual: page,
      sucursales: rows,
      filtrosDisponibles: {
        categorias: listaCategorias,
      },
    };
  }

  /**
   * Crear una sucursal (valida UNIQUE clienteId+codigo).
   */
  static async postOne(data, usuarioId) {
    try{
      const { clienteId, codigo, sucursal, categoria = null } = data || {};
    if (!clienteId || !codigo || !sucursal) {
      throw new Error("clienteId, codigo y sucursal son obligatorios");
    }

    const existe = await Sucursales.findOne({
      where: { clienteId: Number(clienteId), codigo: String(codigo).trim() },
    });
    if (existe) throw new Error("Ya existe una sucursal con ese (clienteId, codigo)");

    const res = await Sucursales.create(
      {
        clienteId: Number(clienteId),
        codigo: String(codigo).trim(),
        sucursal: String(sucursal).trim(),
        categoria: categoria ? String(categoria).trim() : null,
      },
      { usuarioId }
    );

    return res;
    } catch (error) {
            console.error("❌ Error en getByIdConPedidosPaginados:", error);
            throw error;
        }
    
    
    }

  /**
   * Actualizar por id.
   */
  static async update(data, id, usuarioId) {
    const t = await Sucursales.sequelize.transaction();
    try {
      const suc = await Sucursales.findByPk(id, { transaction: t });
      if (!suc) throw new Error("Sucursal no encontrada");

      // Si permiten cambiar codigo/clienteId, cuidar UNIQUE
      // Aquí permitimos actualizar todo excepto id
      await suc.update(
        {
          codigo:    data.codigo    !== undefined ? String(data.codigo).trim() : suc.codigo,
          sucursal:  data.sucursal  !== undefined ? String(data.sucursal).trim() : suc.sucursal,
          categoria: data.categoria !== undefined ? (data.categoria === null ? null : String(data.categoria).trim()) : suc.categoria,
          clienteId: data.clienteId !== undefined ? Number(data.clienteId) : suc.clienteId,
        },
        { transaction: t, individualHooks: true, usuarioId }
      );

      await t.commit();
      return suc;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  /**
   * Autocomplete / select para combos.
   * q busca en (sucursal, codigo). Si pasas clienteId, filtra por cliente.
   */
  static async searchBranches(q, clienteId = null) {
    const where = {};
    if (clienteId) where.clienteId = Number(clienteId);

    if (q) {
      const s = sanitizeLike(q);
      where[Op.or] = [
        { sucursal: { [Op.like]: `%${s}%` } },
        { codigo:   { [Op.like]: `%${s}%` } },
      ];
    }

    const items = await Sucursales.findAll({
      attributes: ["id", "sucursal", "codigo", "categoria", "clienteId"],
      where,
      order: [["sucursal", "ASC"]],
      limit: 20,
    });

    return items;
  }
}

module.exports = SucursalesServices;
