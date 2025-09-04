    # import json, os, sys, time, shutil, traceback, uuid
    # from datetime import datetime, timedelta

    # # ---- Excel COM robusto
    # import psutil
    # import win32com.client as win32
    # from win32com.client import gencache

    # def get_excel_app():
    #     try:
    #         return gencache.EnsureDispatch('Excel.Application')
    #     except Exception:
    #         # reparar caché gen_py dañada
    #         try:
    #             gen_path = gencache.GetGeneratePath()
    #             shutil.rmtree(gen_path, ignore_errors=True)
    #         except Exception:
    #             pass
    #         try:
    #             gencache.Rebuild()
    #         except Exception:
    #             pass
    #         return gencache.EnsureDispatch('Excel.Application')

    # print("Iniciando script generar_excel_con_macro.py")

    # # ------- Args
    # if len(sys.argv) < 3:
    #     print("Uso: python generar_excel_con_macro.py <ruta_json> <carpeta_destino>")
    #     sys.exit(1)

    # ruta_json = sys.argv[1]
    # carpeta_destino = sys.argv[2]
    # sys.stdout.reconfigure(encoding='utf-8')

    # # ------- Asegurar carpeta destino
    # os.makedirs(carpeta_destino, exist_ok=True)

    # # ------- Cerrar Excels colgados
    # try:
    #     for proc in psutil.process_iter():
    #         if proc.name().lower() == "excel.exe":
    #             proc.kill()
    #     print("Excel colgado cerrado (si existía)")
    # except Exception as e:
    #     print(f"No se pudo cerrar Excel: {e}")

    # # ------- Nombre salida
    # nombre_archivo = f"SalidaPedidos_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}_{uuid.uuid4().hex[:6]}.xlsm"
    # ruta_archivo = os.path.join(carpeta_destino, nombre_archivo)

    # try:
    #     if os.path.exists(ruta_archivo):
    #         os.remove(ruta_archivo)

    #     # ------- Plantilla
    #     base_path = os.path.dirname(__file__)
    #     plantilla_path = os.path.join(base_path, "pedidosconmacro.xlsm")
    #     if not os.path.exists(plantilla_path):
    #         print("No se encontró la plantilla:", plantilla_path)
    #         sys.exit(1)

    #     shutil.copy(plantilla_path, ruta_archivo)
    #     print("Plantilla copiada:", ruta_archivo)

    #     # ------- Cargar JSON (soporta objeto o array)
    #     print("Cargando JSON:", ruta_json)
    #     with open(ruta_json, "r", encoding="utf-8") as f:
    #         data = json.load(f)
    #     print("JSON cargado.")

    #     # Normalizar items:
    #     items = []

    #     def extend_items_from_object(obj):
    #         # Busca listas de dicts de primer nivel
    #         for k, v in obj.items():
    #             if isinstance(v, list) and all(isinstance(i, dict) for i in v):
    #                 items.extend(v)

    #     if isinstance(data, list):
    #         # Formato como tu resumen_multipedido.json
    #         for factura in data:
    #             fac_num = (factura.get("numeroFactura") or "").strip()
    #             fac_fecha = factura.get("fechaFactura")
    #             fac_empresa = factura.get("empresa")
    #             lista = factura.get("items", [])
    #             if isinstance(lista, list):
    #                 for it in lista:
    #                     # preserva NumeroFactura (ya viene en tus ítems), y añade contexto por si falta
    #                     it = dict(it)  # copia
    #                     if not it.get("NumeroFactura"):
    #                         it["NumeroFactura"] = fac_num
    #                     if not it.get("Empresa"):
    #                         it["Empresa"] = fac_empresa
    #                     if not it.get("FechaFactura"):
    #                         it["FechaFactura"] = fac_fecha
    #                     items.append(it)
    #     elif isinstance(data, dict):
    #         # Formato antiguo: objeto con arrays (p.ej. "Items Compra")
    #         extend_items_from_object(data)
    #     else:
    #         print("Formato JSON no soportado. Debe ser objeto o arreglo.")
    #         sys.exit(1)

    #     print(f"Total de ítems detectados: {len(items)}")

    #     # ------- Iniciar Excel
    #     excel = get_excel_app()
    #     excel.Visible = False
    #     excel.DisplayAlerts = False
    #     print("Excel iniciado.")

    #     wb = excel.Workbooks.Open(ruta_archivo)
    #     time.sleep(2)
    #     print("Archivo Excel abierto.")

    #     # Loguea todas las hojas para depurar
    #     try:
    #         nombres_hojas = [str(sh.Name) for sh in wb.Worksheets]
    #         print("Hojas en el libro:", nombres_hojas)
    #     except Exception as e:
    #         print("No se pudo listar hojas:", e)

    #     def obtener_hoja(wb, objetivo: str):
    #         objetivo = objetivo.strip().lower()
    #         for sh in wb.Worksheets:
    #             try:
    #                 if str(sh.Name).strip().lower() == objetivo:
    #                     return sh
    #             except Exception:
    #                 pass
    #         # fallback razonables
    #         try:
    #             return wb.ActiveSheet
    #         except Exception:
    #             return wb.Worksheets(1)

    #     ws = obtener_hoja(wb, "Order")
    #     print("Hoja seleccionada:", str(ws.Name))

    #     # ------- Fecha entrega (3 días hábiles)
    #     def sumar_dias_habiles(fecha_inicio, dias_habiles):
    #         fecha = fecha_inicio
    #         while dias_habiles > 0:
    #             fecha += timedelta(days=1)
    #             if fecha.weekday() < 5:
    #                 dias_habiles -= 1
    #         return fecha

    #     hoy = datetime.today()
    #     fecha_entrega = sumar_dias_habiles(hoy, 3)
    #     fecha_formateada = fecha_entrega.strftime("%d/%m/%Y")

    #     # ------- Insertar filas
    #     fila = 10
    #     insertados = 0
    #     for item in items:
    #         # Campos con default seguro
    #         sales = item.get("sales", "") or ""
    #         codigoCliente = item.get("codigoCliente", "") or ""
    #         cust = item.get("cust", "") or (item.get("NumeroFactura", "") or "")
    #         material = item.get("Material", "") or ""
    #         cantidad = item.get("Cantidad", "") or ""
    #         unidad_txt = "CS-Case"

    #         # Escribir celdas
    #         ws.Range(f"A{fila}").Value = sales
    #         ws.Range(f"B{fila}").Value = codigoCliente
    #         ws.Range(f"D{fila}").Value = cust
    #         ws.Range(f"E{fila}").Value = fecha_formateada
    #         ws.Range(f"I{fila}").Value = "USD"
    #         ws.Range(f"FL{fila}").Value = material
    #         ws.Range(f"FP{fila}").Value = cantidad
    #         ws.Range(f"FQ{fila}").Value = unidad_txt

    #         fila += 1
    #         insertados += 1

    #     print(f"Filas insertadas: {insertados}")

    #     # ------- Guardar y cerrar
    #     wb.Save()
    #     wb.Close(False)
    #     excel.Quit()
    #     print("Excel guardado y cerrado.")

    #     print(f"ARCHIVO_GENERADO:{ruta_archivo}")
    #     sys.exit(0)

    # except Exception:
    #     print("Error en Python:")
    #     traceback.print_exc()
    #     try:
    #         if 'wb' in locals():
    #             wb.Close(False)
    #         if 'excel' in locals():
    #             excel.Quit()
    #     except Exception:
    #         pass
    #     sys.exit(1)
    # -*- coding: utf-8 -*-
    # -*- coding: utf-8 -*-
# generar_excel_con_macro.py — COM-only (preserva botones), guardado robusto, pre/post kill
import json, os, sys, time, shutil, traceback, uuid, subprocess, gc, re
from datetime import datetime, timedelta

import psutil
import pythoncom
from win32com.client import gencache, DispatchEx

# ---------- Config ----------
SHEET_NAME = "Order"
START_ROW  = 10
MAX_SAVE_TRIES = 6
BUSY_HRESULT = -2146777998  # 0x800AC472

try:
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
except Exception:
    pass
os.environ['PYTHONUNBUFFERED'] = '1'

# ---------- Utilidades procesos ----------
def list_excel_pids():
    out = []
    for p in psutil.process_iter(attrs=['pid','name']):
        try:
            if (p.info['name'] or '').lower() == 'excel.exe':
                out.append(p.info['pid'])
        except Exception:
            pass
    return out

def kill_excel_processes():
    for pid in list_excel_pids():
        try: psutil.Process(pid).kill()
        except Exception: pass
    try:
        subprocess.run(["taskkill","/F","/IM","EXCEL.EXE","/T"],
                       check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

def preflight_close_all_excel():
    print("[PRE] Cerrando Excel previos...", flush=True)
    kill_excel_processes()
    time.sleep(0.5)
    print("[PRE] Excel limpio:", list_excel_pids() == [], flush=True)

def postflight_cleanup_excel(excel_app=None):
    try:
        if excel_app is not None:
            excel_app.Quit()
    except Exception:
        pass
    try: del excel_app
    except Exception: pass
    gc.collect(); gc.collect()
    kill_excel_processes()

# ---------- Excel helpers ----------
def get_excel_app_new_instance():
    try:
        return DispatchEx("Excel.Application")
    except Exception:
        return gencache.EnsureDispatch("Excel.Application")

def wait_excel_ready(app, timeout_s=15):
    end = time.time() + timeout_s
    while time.time() < end:
        try:
            _ = app.Ready
            return True
        except Exception:
            time.sleep(0.2)
    return False

def find_usable_sheet(wb, preferred=SHEET_NAME):
    try:
        ws = wb.Sheets(preferred); _ = ws.Name; return ws
    except Exception:
        pass
    try:
        cnt = int(wb.Worksheets.Count)
        for i in range(1, cnt+1):
            try:
                ws = wb.Worksheets.Item(i); _ = ws.Name; return ws
            except Exception:
                continue
    except Exception:
        pass
    try:
        ws = wb.Sheets.Item(1); _ = ws.Name; return ws
    except Exception:
        pass
    raise RuntimeError("No encontré ninguna hoja utilizable en el libro.")

def write_row(ws, row_idx, values_by_col):
    for col, val in values_by_col.items():
        ws.Range(f"{col}{row_idx}").Value = val

def save_with_retries_or_copy(wb, final_path):
    for i in range(1, MAX_SAVE_TRIES+1):
        try:
            wait_excel_ready(wb.Application, 5)
            wb.Save()
            time.sleep(0.3)
            if os.path.exists(final_path) and os.path.getsize(final_path) > 0:
                print(f"[SAVE] Save OK (intento {i}).", flush=True)
                return
        except Exception as e:
            print(f"[SAVE] intento {i} falló: {e}", flush=True)
            time.sleep(0.5 + 0.3*i)

    base, ext = os.path.splitext(final_path)
    tmp_path = base + f"._tmp_{uuid.uuid4().hex}" + (ext or ".xlsm")
    ok = False
    for i in range(1, MAX_SAVE_TRIES+1):
        try:
            wait_excel_ready(wb.Application, 5)
            wb.SaveCopyAs(tmp_path)
            ok = True
            print(f"[SAVE] SaveCopyAs OK (intento {i}): {tmp_path}", flush=True)
            break
        except Exception as e:
            print(f"[SAVE] SaveCopyAs falló (intento {i}): {e}", flush=True)
            time.sleep(0.6 + 0.3*i)
    try: wb.Close(SaveChanges=False)
    except Exception: pass
    if not ok and not (os.path.exists(tmp_path) and os.path.getsize(tmp_path) > 0):
        raise FileNotFoundError("[SAVE] No se pudo generar TMP con SaveCopyAs.")
    os.replace(tmp_path, final_path)
    print(f"[SAVE] Reemplazo atómico → {final_path}", flush=True)

# ---------- Negocio ----------
def sumar_dias_habiles(fecha_inicio, dias_habiles):
    fecha = fecha_inicio
    while dias_habiles > 0:
        fecha += timedelta(days=1)
        if fecha.weekday() < 5:
            dias_habiles -= 1
    return fecha

def parse_forced_date(s):
    if not s: return None
    m = re.match(r"^\s*(\d{2})/(\d{2})/(\d{4})\s*$", s)
    if m:
        d, mth, y = map(int, m.groups())
        return datetime(y, mth, d)
    m = re.match(r"^\s*(\d{4})-(\d{2})-(\d{2})\s*$", s)
    if m:
        y, mth, d = map(int, m.groups())
        return datetime(y, mth, d)
    return None

def ensure_future_business_day(dt):
    today = datetime.today().date()
    d = dt.date()
    if d <= today:
        d = today + timedelta(days=1)
        while d.weekday() >= 5:
            d += timedelta(days=1)
        return datetime(d.year, d.month, d.day)
    return datetime(dt.year, dt.month, dt.day)

# ---------- Main ----------
def main():
    print("Iniciando script (COM-only, preserva botones)", flush=True)
    if len(sys.argv) < 3:
        print("Uso: python generar_excel_con_macro.py <ruta_json> <carpeta_destino> [--fecha=dd/mm/yyyy]", flush=True)
        sys.exit(1)

    ruta_json = sys.argv[1]
    carpeta_destino = sys.argv[2]
    fecha_forzada = None
    if len(sys.argv) >= 4 and sys.argv[3].startswith("--fecha="):
        fecha_forzada = parse_forced_date(sys.argv[3][8:])

    if not os.path.exists(ruta_json):
        print("❌ No existe el JSON:", ruta_json, flush=True); sys.exit(1)
    os.makedirs(carpeta_destino, exist_ok=True)

    preflight_close_all_excel()

    base_path = os.path.dirname(__file__)
    plantilla_path = os.path.join(base_path, "pedidosconmacro.xlsm")
    if not os.path.exists(plantilla_path):
        print("❌ No se encontró la plantilla:", plantilla_path, flush=True); sys.exit(1)

    nombre_archivo = f"SalidaPedidos_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}_{uuid.uuid4().hex[:6]}.xlsm"
    ruta_archivo = os.path.join(carpeta_destino, nombre_archivo)

    try:
        if os.path.exists(ruta_archivo):
            try: os.remove(ruta_archivo)
            except Exception: pass
        shutil.copy(plantilla_path, ruta_archivo)
        print("Plantilla copiada:", ruta_archivo, flush=True)

        print("Cargando JSON:", ruta_json, flush=True)
        with open(ruta_json, "r", encoding="utf-8") as f:
            data = json.load(f)
        print("JSON cargado.", flush=True)

        items = []
        def extend_items_from_object(obj):
            for _, v in obj.items():
                if isinstance(v, list) and all(isinstance(i, dict) for i in v):
                    items.extend(v)

        if isinstance(data, list):
            for factura in data:
                fac_num = (factura.get("numeroFactura") or "").strip()
                fac_fecha = factura.get("fechaFactura")
                fac_empresa = factura.get("empresa")
                lista = factura.get("items", [])
                if isinstance(lista, list):
                    for it in lista:
                        it = dict(it)
                        it.setdefault("NumeroFactura", fac_num)
                        it.setdefault("Empresa",       fac_empresa)
                        it.setdefault("FechaFactura",  fac_fecha)
                        items.append(it)
        elif isinstance(data, dict):
            extend_items_from_object(data)
        else:
            print("Formato JSON no soportado. Debe ser objeto o arreglo.", flush=True)
            sys.exit(1)

        print(f"Total de ítems detectados: {len(items)}", flush=True)

        # --- FECHA a usar ---
        if fecha_forzada:
            fecha_dt = fecha_forzada
        else:
            hoy = datetime.today()
            fecha_dt = sumar_dias_habiles(hoy, 3)
        fecha_dt = ensure_future_business_day(fecha_dt)
        y, m, d = fecha_dt.year, fecha_dt.month, fecha_dt.day
        fecha_str = f"{d:02d}/{m:02d}/{y}"

        # --- Excel COM ---
        pythoncom.CoInitialize()
        excel = get_excel_app_new_instance()
        try: excel.Visible = False
        except Exception: pass
        try: excel.DisplayAlerts = False
        except Exception: pass
        try: excel.ScreenUpdating = False
        except Exception: pass
        try: excel.AskToUpdateLinks = False
        except Exception: pass
        try: excel.EnableEvents = True  # dejar que la plantilla aplique formatos/validaciones
        except Exception: pass

        wait_excel_ready(excel, 10)

        wb = excel.Workbooks.Open(
            ruta_archivo,
            UpdateLinks=False,
            ReadOnly=False,
            IgnoreReadOnlyRecommended=True,
            CorruptLoad=0
        )
        wait_excel_ready(excel, 10)
        print("Archivo Excel abierto.", flush=True)

        ws = find_usable_sheet(wb, preferred=SHEET_NAME)
        print("Hoja usada:", ws.Name, flush=True)

        fila = START_ROW
        insertados = 0
        for it in items:
            values = {
                "A":  (it.get("sales","") or ""),
                "B":  (it.get("codigoCliente","") or ""),
                "D":  (it.get("cust","") or (it.get("NumeroFactura","") or "")),
                "I":  "USD",
                "FL": (it.get("Material","") or ""),
                "FP": (it.get("Cantidad","") or ""),
                "FQ": "CS-Case",
            }

            ok = False
            for t in range(1, 7):
                try:
                    write_row(ws, fila, values)

                    # === Fecha robusta: fórmula DATE() y luego pegar valores ===
                    cell = ws.Range(f"E{fila}")
                    cell.Formula = f"=DATE({y},{m},{d})"  # idioma invariante
                    # opcional: dar tiempo a que corran eventos/validaciones
                    time.sleep(0.05)
                    try:
                        cell.Copy()
                        cell.PasteSpecial(Paste=-4163)  # xlPasteValues
                        excel.CutCopyMode = False
                    except Exception:
                        pass

                    # verificación rápida (3 primeras filas)
                    if insertados < 3:
                        try:
                            print(f"[DBG] E{fila} -> Value2={cell.Value2} Text='{cell.Text}'", flush=True)
                        except Exception:
                            pass

                    ok = True
                    break
                except Exception as e:
                    if BUSY_HRESULT == getattr(e, "hresult", None) or "0x800ac472" in str(e).lower():
                        time.sleep(0.2 * t)
                        continue
                    else:
                        raise

            if ok: insertados += 1
            else: print(f"⚠️ No pude escribir fila {fila}", flush=True)
            fila += 1

        print(f"Filas insertadas: {insertados}", flush=True)

        save_with_retries_or_copy(wb, ruta_archivo)

        try: excel.Quit()
        except Exception: pass
        pythoncom.CoUninitialize()

        print("Excel guardado y cerrado.", flush=True)
        print(f"ARCHIVO_GENERADO:{ruta_archivo}", flush=True)
        postflight_cleanup_excel(None)
        sys.exit(0)

    except Exception:
        print("Error en Python:", flush=True)
        traceback.print_exc()
        try:
            if 'wb' in locals(): wb.Close(False)
        except Exception: pass
        try:
            if 'excel' in locals(): excel.Quit()
        except Exception: pass
        try: pythoncom.CoUninitialize()
        except Exception: pass
        postflight_cleanup_excel(None)
        sys.exit(1)

if __name__ == "__main__":
    main()
