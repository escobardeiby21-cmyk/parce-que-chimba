import sys
import os
import json
import time
import urllib.request
import urllib.parse
import threading
import webbrowser
import csv
from datetime import datetime

try:
    import tkinter as tk
    from tkinter import ttk, messagebox
except ImportError:
    print("Error: Tkinter no está instalado.")
    sys.exit(1)

try:
    import winsound
except ImportError:
    winsound = None

try:
    from PIL import Image, ImageTk
except ImportError:
    Image = None
    ImageTk = None

# Configuración Global y Endpoints
CLOUD_URL = "https://www.parcequechimba.com/api/orders"
LOCAL_URL = "http://localhost:3333/api/orders"
DATA_FILE = "crm_local_db.json"

class ParceQueChimbaCRM:
    def __init__(self, root):
        self.root = root
        self.root.title("🔥 Que Chimba Parce - Pro Desktop CRM & ERP Suite v1.0")
        self.root.geometry("1100x750")
        self.root.minsize(950, 650)
        self.root.configure(bg="#121212")

        # Estado Global
        self.orders = []
        self.known_order_ids = set()
        self.deleted_order_ids = {"WPP-2240", "WPP-1990", "WPP-8355"}
        self.is_initial_load = True
        self.is_business_open = True
        self.is_chatbot_enabled = False
        self.last_selected_order_id = None

        # Inventario por defecto
        self.inventory = [
            {"id": "inv1", "name": "Pan Brioche Hamburguesa", "category": "Panes", "stock": 45, "min": 15, "unit": "unidades"},
            {"id": "inv2", "name": "Carne Hamburguesa 150g", "category": "Carnes", "stock": 50, "min": 20, "unit": "unidades"},
            {"id": "inv3", "name": "Salchicha Perro Caliente", "category": "Carnes", "stock": 30, "min": 10, "unit": "unidades"},
            {"id": "inv4", "name": "Patatas Fritas Congeladas", "category": "Insumos", "stock": 25, "min": 8, "unit": "kg"},
            {"id": "inv5", "name": "Chicharrón al Barril", "category": "Carnes", "stock": 12, "min": 4, "unit": "kg"},
            {"id": "inv6", "name": "Costilla al Barril", "category": "Carnes", "stock": 15, "min": 5, "unit": "kg"},
            {"id": "inv7", "name": "Longaniza Paisa", "category": "Carnes", "stock": 35, "min": 12, "unit": "unidades"},
            {"id": "inv8", "name": "Postobón Manzana", "category": "Bebidas", "stock": 48, "min": 12, "unit": "latas"},
            {"id": "inv9", "name": "Postobón Colombiana", "category": "Bebidas", "stock": 36, "min": 10, "unit": "latas"},
            {"id": "inv10", "name": "Coca-Cola 330ml", "category": "Bebidas", "stock": 60, "min": 15, "unit": "latas"}
        ]

        # Repartidores por defecto
        self.drivers = [
            {"id": "d1", "name": "Repartidor 1 (Juan)", "phone": "34600000001"},
            {"id": "d2", "name": "Repartidor 2 (Carlos)", "phone": "34600000002"}
        ]

        self.load_local_storage()
        self.setup_styles()
        self.build_ui()

        # Iniciar Hilo de Sincronización en Tiempo Real
        self.sync_thread = threading.Thread(target=self.sync_loop, daemon=True)
        self.sync_thread.start()

    def setup_styles(self):
        self.style = ttk.Style()
        self.style.theme_use("clam")

        # Configurar colores oscuros premium
        self.style.configure("TFrame", background="#121212")
        self.style.configure("Card.TFrame", background="#1e1e1e", relief="flat")
        self.style.configure("TLabel", background="#121212", foreground="#ffffff", font=("Segoe UI", 10))
        self.style.configure("Header.TLabel", background="#121212", foreground="#f59e0b", font=("Segoe UI", 16, "bold"))
        self.style.configure("SubHeader.TLabel", background="#121212", foreground="#9ca3af", font=("Segoe UI", 10))
        
        # Pestañas
        self.style.configure("TNotebook", background="#121212", borderwidth=0)
        self.style.configure("TNotebook.Tab", background="#1e1e1e", foreground="#d1d5db", padding=[14, 7], font=("Segoe UI", 10, "bold"))
        self.style.map("TNotebook.Tab", background=[("selected", "#f59e0b")], foreground=[("selected", "#000000")])

        # Botones
        self.style.configure("TButton", font=("Segoe UI", 10, "bold"), background="#f59e0b", foreground="#000000", borderwidth=0, padding=6)
        self.style.map("TButton", background=[("active", "#d97706")])

    def build_ui(self):
        # Header Superior
        header_frame = tk.Frame(self.root, bg="#1a1a1a", height=60)
        header_frame.pack(fill="x", side="top")

        # Cargar y colocar Logo Oficial del proyecto
        logo_path = os.path.join("public", "logo.png")
        if not os.path.exists(logo_path):
            logo_path = os.path.join("public", "logo.jpg")

        if os.path.exists(logo_path) and Image and ImageTk:
            try:
                img = Image.open(logo_path).resize((44, 44), Image.Resampling.LANCZOS)
                self.logo_img = ImageTk.PhotoImage(img)
                lbl_logo = tk.Label(header_frame, image=self.logo_img, bg="#1a1a1a")
                lbl_logo.pack(side="left", padx=(16, 4), pady=6)

                # Icono de la ventana
                self.root.iconphoto(True, self.logo_img)
            except Exception:
                pass

        lbl_title = tk.Label(header_frame, text="QUE CHIMBA PARCE — SUITE EMPRESARIAL CRM & ERPS", bg="#1a1a1a", fg="#f59e0b", font=("Segoe UI", 14, "bold"))
        lbl_title.pack(side="left", padx=10, pady=12)

        btn_sound_test = tk.Button(header_frame, text="🔔 Probar Audio", bg="#374151", fg="white", font=("Segoe UI", 9, "bold"), relief="flat", command=self.test_audio_chime)
        btn_sound_test.pack(side="right", padx=10)

        self.lbl_status = tk.Label(header_frame, text="🟢 CONECTADO A LA NUBE EN TIEMPO REAL", bg="#1a1a1a", fg="#10b981", font=("Segoe UI", 10, "bold"))
        self.lbl_status.pack(side="right", padx=10)

        # Contenedor de Pestañas
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill="both", expand=True, padx=12, pady=12)

        # Tab 1: Pedidos en Tiempo Real
        self.tab_orders = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_orders, text="⚡ Pedidos en Vivo & Cocina")
        self.build_tab_orders()

        # Tab 2: CRM Clientes
        self.tab_crm = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_crm, text="👥 CRM Clientes & VIP")
        self.build_tab_crm()

        # Tab 3: Control de Inventario
        self.tab_inventory = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_inventory, text="📦 Control de Inventario")
        self.build_tab_inventory()

        # Tab 4: Repartidores & Domicilios
        self.tab_drivers = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_drivers, text="🛵 Repartidores & Domicilios")
        self.build_tab_drivers()

        # Tab 5: Contabilidad & Reportes
        self.tab_accounting = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_accounting, text="📊 Contabilidad & Ventas")
        self.build_tab_accounting()

    # --- TAB 1: PEDIDOS EN VIVO ---
    def build_tab_orders(self):
        top_bar = tk.Frame(self.tab_orders, bg="#121212")
        top_bar.pack(fill="x", pady=6)

        btn_manual = tk.Button(top_bar, text="➕ Crear Pedido Manual (Llamada / Wpp)", bg="#f59e0b", fg="black", font=("Segoe UI", 9, "bold"), relief="flat", command=self.create_manual_order_dialog)
        btn_manual.pack(side="left", padx=5)

        btn_refresh = tk.Button(top_bar, text="🔄 Refrescar Nube", bg="#3b82f6", fg="white", font=("Segoe UI", 9, "bold"), relief="flat", command=self.manual_sync)
        btn_refresh.pack(side="left", padx=5)

        self.lbl_orders_count = tk.Label(top_bar, text="Pedidos Totales: 0", bg="#121212", fg="#9ca3af", font=("Segoe UI", 10, "bold"))
        self.lbl_orders_count.pack(side="right", padx=5)

        # Tabla Treeview para Pedidos (incluye columna Repartidor)
        columns = ("id", "time", "client", "phone", "address", "total", "payment", "driver", "status")
        self.tree_orders = ttk.Treeview(self.tab_orders, columns=columns, show="headings", height=15)

        self.tree_orders.heading("id", text="ID Pedido")
        self.tree_orders.heading("time", text="Hora")
        self.tree_orders.heading("client", text="Cliente")
        self.tree_orders.heading("phone", text="Teléfono")
        self.tree_orders.heading("address", text="Dirección")
        self.tree_orders.heading("total", text="Total (€)")
        self.tree_orders.heading("payment", text="Pago")
        self.tree_orders.heading("driver", text="Repartidor")
        self.tree_orders.heading("status", text="Estado")

        self.tree_orders.column("id", width=100, anchor="center")
        self.tree_orders.column("time", width=75, anchor="center")
        self.tree_orders.column("client", width=130)
        self.tree_orders.column("phone", width=100, anchor="center")
        self.tree_orders.column("address", width=220)
        self.tree_orders.column("total", width=80, anchor="center")
        self.tree_orders.column("payment", width=85, anchor="center")
        self.tree_orders.column("driver", width=140, anchor="center")
        self.tree_orders.column("status", width=110, anchor="center")

        self.tree_orders.pack(fill="both", expand=True, pady=6)

        # Capturar clic y doble clic en cualquier pedido para que NUNCA se pierda la selección
        def on_order_click(event):
            sel = self.tree_orders.selection()
            if sel:
                try:
                    self.last_selected_order_id = str(self.tree_orders.item(sel[0])["values"][0])
                except Exception:
                    pass

        self.tree_orders.bind("<ButtonRelease-1>", on_order_click)
        self.tree_orders.bind("<Double-1>", lambda e: self.confirm_and_notify_both_dialog())

        # Botones de Acción de Pedidos
        action_bar = tk.Frame(self.tab_orders, bg="#121212")
        action_bar.pack(fill="x", pady=6)

        btn_both = tk.Button(action_bar, text="🚀 Confirmar y Notificar (Cliente + Repartidor)", bg="#f59e0b", fg="black", font=("Segoe UI", 10, "bold"), command=self.confirm_and_notify_both_dialog)
        btn_both.pack(side="left", padx=4)

        btn_deliver = tk.Button(action_bar, text="✅ Marcar ENTREGADO", bg="#10b981", fg="white", font=("Segoe UI", 10, "bold"), command=self.mark_selected_delivered)
        btn_deliver.pack(side="left", padx=4)

        btn_wpp = tk.Button(action_bar, text="💬 WhatsApp Cliente", bg="#374151", fg="white", font=("Segoe UI", 10, "bold"), command=self.open_selected_whatsapp)
        btn_wpp.pack(side="left", padx=4)

        btn_notify_drv = tk.Button(action_bar, text="🛵 WhatsApp Repartidor", bg="#25D366", fg="white", font=("Segoe UI", 10, "bold"), command=self.send_driver_whatsapp_notification)
        btn_notify_drv.pack(side="left", padx=4)

        btn_del_order = tk.Button(action_bar, text="🗑️ Eliminar Pedido", bg="#ef4444", fg="white", font=("Segoe UI", 10, "bold"), command=self.delete_selected_order)
        btn_del_order.pack(side="left", padx=4)

    # --- TAB 2: CRM CLIENTES ---
    def build_tab_crm(self):
        top_bar = tk.Frame(self.tab_crm, bg="#121212")
        top_bar.pack(fill="x", pady=6)

        lbl_crm_title = tk.Label(top_bar, text="👥 Directorio CRM de Clientes Registrados", bg="#121212", fg="#f59e0b", font=("Segoe UI", 12, "bold"))
        lbl_crm_title.pack(side="left")

        columns = ("phone", "client", "address", "orders_count", "total_spent", "badge")
        self.tree_crm = ttk.Treeview(self.tab_crm, columns=columns, show="headings", height=18)

        self.tree_crm.heading("phone", text="Teléfono")
        self.tree_crm.heading("client", text="Nombre Cliente")
        self.tree_crm.heading("address", text="Última Dirección")
        self.tree_crm.heading("orders_count", text="Nº Pedidos")
        self.tree_crm.heading("total_spent", text="Gasto Total (€)")
        self.tree_crm.heading("badge", text="Etiqueta Fidelidad")

        self.tree_crm.column("phone", width=120, anchor="center")
        self.tree_crm.column("client", width=160)
        self.tree_crm.column("address", width=320)
        self.tree_crm.column("orders_count", width=100, anchor="center")
        self.tree_crm.column("total_spent", width=120, anchor="center")
        self.tree_crm.column("badge", width=140, anchor="center")

        self.tree_crm.pack(fill="both", expand=True, pady=6)

        action_bar = tk.Frame(self.tab_crm, bg="#121212")
        action_bar.pack(fill="x", pady=6)

        btn_offer = tk.Button(action_bar, text="🎁 Enviar Oferta por WhatsApp", bg="#f59e0b", fg="black", font=("Segoe UI", 10, "bold"), command=self.send_promo_whatsapp)
        btn_offer.pack(side="left", padx=5)

    # --- TAB 3: INVENTARIO ---
    def build_tab_inventory(self):
        columns = ("id", "name", "category", "stock", "min", "cost", "unit", "status")
        self.tree_inv = ttk.Treeview(self.tab_inventory, columns=columns, show="headings", height=15)

        self.tree_inv.heading("id", text="ID Insumo")
        self.tree_inv.heading("name", text="Nombre Insumo")
        self.tree_inv.heading("category", text="Categoría")
        self.tree_inv.heading("stock", text="Stock Actual")
        self.tree_inv.heading("min", text="Alerta Mínima")
        self.tree_inv.heading("cost", text="Costo Unit (€)")
        self.tree_inv.heading("unit", text="Unidad")
        self.tree_inv.heading("status", text="Estado Stock")

        self.tree_inv.column("id", width=80, anchor="center")
        self.tree_inv.column("name", width=200)
        self.tree_inv.column("category", width=120, anchor="center")
        self.tree_inv.column("stock", width=100, anchor="center")
        self.tree_inv.column("min", width=100, anchor="center")
        self.tree_inv.column("cost", width=110, anchor="center")
        self.tree_inv.column("unit", width=90, anchor="center")
        self.tree_inv.column("status", width=130, anchor="center")

        self.tree_inv.pack(fill="both", expand=True, pady=6)

        action_bar = tk.Frame(self.tab_inventory, bg="#121212")
        action_bar.pack(fill="x", pady=6)

        btn_custom = tk.Button(action_bar, text="➕ Sumar Cantidad (+X)", bg="#10b981", fg="white", font=("Segoe UI", 10, "bold"), command=self.add_custom_stock_dialog)
        btn_custom.pack(side="left", padx=4)

        btn_edit = tk.Button(action_bar, text="✏️ Cambiar Cantidad / Costo (€)", bg="#3b82f6", fg="white", font=("Segoe UI", 10, "bold"), command=self.edit_selected_inventory)
        btn_edit.pack(side="left", padx=4)

        btn_new = tk.Button(action_bar, text="➕ Insumo Nuevo", bg="#8b5cf6", fg="white", font=("Segoe UI", 10, "bold"), command=self.add_new_inventory_dialog)
        btn_new.pack(side="left", padx=4)

        btn_reset = tk.Button(action_bar, text="🔄 Resetear TODO a 0", bg="#f59e0b", fg="black", font=("Segoe UI", 10, "bold"), command=self.reset_all_stock_to_zero)
        btn_reset.pack(side="left", padx=4)

        btn_del = tk.Button(action_bar, text="🗑️ Eliminar", bg="#ef4444", fg="white", font=("Segoe UI", 10, "bold"), command=self.delete_selected_inventory)
        btn_del.pack(side="left", padx=4)

        self.render_inventory()

    # --- TAB 4: CONTABILIDAD ---
    def build_tab_accounting(self):
        cards_frame = tk.Frame(self.tab_accounting, bg="#121212")
        cards_frame.pack(fill="x", pady=16)

        # Card Ventas
        c1 = tk.Frame(cards_frame, bg="#1e1e1e", padx=16, pady=16, relief="flat")
        c1.pack(side="left", fill="both", expand=True, padx=6)
        tk.Label(c1, text="VENTAS TOTALES", bg="#1e1e1e", fg="#9ca3af", font=("Segoe UI", 9, "bold")).pack()
        self.lbl_acc_sales = tk.Label(c1, text="0.00 €", bg="#1e1e1e", fg="#f59e0b", font=("Segoe UI", 18, "bold"))
        self.lbl_acc_sales.pack()

        # Card Efectivo
        c2 = tk.Frame(cards_frame, bg="#1e1e1e", padx=16, pady=16, relief="flat")
        c2.pack(side="left", fill="both", expand=True, padx=6)
        tk.Label(c2, text="EFECTIVO METÁLICO", bg="#1e1e1e", fg="#9ca3af", font=("Segoe UI", 9, "bold")).pack()
        self.lbl_acc_cash = tk.Label(c2, text="0.00 €", bg="#1e1e1e", fg="#10b981", font=("Segoe UI", 18, "bold"))
        self.lbl_acc_cash.pack()

        # Card Bizum
        c3 = tk.Frame(cards_frame, bg="#1e1e1e", padx=16, pady=16, relief="flat")
        c3.pack(side="left", fill="both", expand=True, padx=6)
        tk.Label(c3, text="PAGADO POR BIZUM", bg="#1e1e1e", fg="#9ca3af", font=("Segoe UI", 9, "bold")).pack()
        self.lbl_acc_bizum = tk.Label(c3, text="0.00 €", bg="#1e1e1e", fg="#3b82f6", font=("Segoe UI", 18, "bold"))
        self.lbl_acc_bizum.pack()

        # Botones de Acción de Contabilidad
        acc_bar = tk.Frame(self.tab_accounting, bg="#121212")
        acc_bar.pack(pady=20)

        btn_export = tk.Button(acc_bar, text="📥 Exportar Libro Contable a Excel (CSV)", bg="#10b981", fg="white", font=("Segoe UI", 11, "bold"), pady=8, padx=12, command=self.export_csv)
        btn_export.pack(side="left", padx=8)

        btn_reset_acc = tk.Button(acc_bar, text="🧹 Resetear TODA la Contabilidad (Borrar Todo)", bg="#ef4444", fg="white", font=("Segoe UI", 11, "bold"), pady=8, padx=12, command=self.clear_all_accounting_history)
        btn_reset_acc.pack(side="left", padx=8)

    # --- LÓGICA DE DATOS Y SINCRONIZACIÓN EN TIEMPO REAL ---
    def sync_loop(self):
        while True:
            try:
                self.fetch_orders()
            except Exception as e:
                pass
            time.sleep(3)

    def fetch_orders(self):
        cloud_orders = []
        local_orders = []

        # 1. Obtener Pedidos Globales de la Nube Oficial (parcequechimba.com)
        try:
            req = urllib.request.Request(CLOUD_URL, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    if isinstance(data.get("orders"), list):
                        cloud_orders = data["orders"]
                    elif isinstance(data.get("data", {}).get("orders"), list):
                        cloud_orders = data["data"]["orders"]
        except Exception:
            pass

        # 2. Obtener Pedidos del Servidor Bot de WhatsApp Local
        try:
            req_loc = urllib.request.Request(LOCAL_URL, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req_loc, timeout=2) as response:
                if response.status == 200:
                    data_loc = json.loads(response.read().decode())
                    if isinstance(data_loc.get("orders"), list):
                        local_orders = data_loc["orders"]
        except Exception:
            pass

        # Combinar todos los pedidos de WhatsApp y Web evitando duplicados por ID y descartando los eliminados
        merged_map = {}
        for o in (cloud_orders + local_orders):
            if isinstance(o, dict) and o.get("id"):
                oid = str(o["id"])
                if oid not in self.deleted_order_ids:
                    merged_map[oid] = o

        merged_list = list(merged_map.values())
        self.process_incoming_orders(merged_list)

    def manual_sync(self):
        threading.Thread(target=self.fetch_orders, daemon=True).start()
        messagebox.showinfo("Sincronización", "¡Sincronización ejecutada con éxito desde la Nube!")

    def test_audio_chime(self):
        try:
            self.root.bell()
            if winsound:
                try:
                    winsound.MessageBeep(winsound.MB_ICONASTERISK)
                    winsound.Beep(1200, 250)
                    winsound.Beep(1600, 350)
                except Exception:
                    pass
            messagebox.showinfo("Prueba de Sonido", "🔊 ¡Prueba de timbre ejecutada!\nSi escuchaste los pitidos/campana, el audio de notificaciones está 100% activo.")
        except Exception as e:
            messagebox.showerror("Error de Audio", f"No se pudo reproducir el sonido: {e}")

    def process_incoming_orders(self, new_orders):
        has_new = False
        for o in new_orders:
            oid = o.get("id")
            if oid and oid not in self.known_order_ids:
                self.known_order_ids.add(oid)
                has_new = True

        self.orders = new_orders
        self.save_local_storage()

        # Reproducir timbre si entra un pedido nuevo
        if has_new and not self.is_initial_load:
            try:
                self.root.bell()
                if winsound:
                    winsound.MessageBeep(winsound.MB_ICONASTERISK)
                    winsound.Beep(900, 200)
                    winsound.Beep(1400, 300)
                    winsound.Beep(1900, 400)
            except Exception:
                pass

        self.is_initial_load = False
        self.root.after(0, self.render_all)

    def render_all(self):
        self.render_orders()
        self.render_crm()
        self.render_accounting()

    def render_orders(self):
        # Recordar cuál estaba seleccionado antes de refrescar para que no se borre el resaltado
        sel = self.tree_orders.selection()
        current_sel_id = None
        if sel:
            try:
                current_sel_id = str(self.tree_orders.item(sel[0])["values"][0])
            except Exception:
                pass
        if not current_sel_id:
            current_sel_id = self.last_selected_order_id

        for item in self.tree_orders.get_children():
            self.tree_orders.delete(item)

        self.lbl_orders_count.config(text=f"Pedidos Totales: {len(self.orders)}")

        target_node = None
        for o in self.orders:
            oid = str(o.get("id", ""))
            driver_display = o.get("assignedDriver") or "❌ Sin Asignar"
            node = self.tree_orders.insert("", "end", values=(
                oid,
                o.get("timeStr", ""),
                o.get("clientName", "Cliente"),
                o.get("phone", ""),
                o.get("address", ""),
                f"{o.get('total', 0):.2f}€",
                o.get("paymentMethod", "Efectivo"),
                driver_display,
                o.get("status", "En Cocina")
            ))
            if current_sel_id and oid == current_sel_id:
                target_node = node

        # Restablecer la selección visualmente
        if target_node:
            try:
                self.tree_orders.selection_set(target_node)
                self.tree_orders.focus(target_node)
            except Exception:
                pass

    def render_crm(self):
        for item in self.tree_crm.get_children():
            self.tree_crm.delete(item)

        clients = {}
        for o in self.orders:
            phone = o.get("phone")
            if not phone:
                continue
            if phone not in clients:
                clients[phone] = {
                    "phone": phone,
                    "name": o.get("clientName", "Cliente"),
                    "address": o.get("address", ""),
                    "count": 0,
                    "spent": 0.0
                }
            clients[phone]["count"] += 1
            clients[phone]["spent"] += o.get("total", 0.0)

        for c in clients.values():
            badge = "🌟 VIP" if c["count"] >= 3 or c["spent"] >= 40 else ("🛵 Frecuente" if c["count"] >= 2 else "🆕 Nuevo")
            self.tree_crm.insert("", "end", values=(
                c["phone"],
                c["name"],
                c["address"],
                c["count"],
                f"{c['spent']:.2f}€",
                badge
            ))

    def render_inventory(self):
        for item in self.tree_inv.get_children():
            self.tree_inv.delete(item)

        for i in self.inventory:
            status = "🔴 AGOTADO" if i["stock"] == 0 else ("⚠️ BAJO" if i["stock"] <= i["min"] else "🟢 ÓPTIMO")
            cost_str = f"{i.get('unitCost', 1.00):.2f}€"
            self.tree_inv.insert("", "end", values=(
                i["id"],
                i["name"],
                i["category"],
                i["stock"],
                i["min"],
                cost_str,
                i["unit"],
                status
            ))

    def render_accounting(self):
        total_sales = sum(o.get("total", 0) for o in self.orders)
        total_cash = sum(o.get("total", 0) for o in self.orders if o.get("paymentMethod") == "Efectivo")
        total_bizum = sum(o.get("total", 0) for o in self.orders if o.get("paymentMethod") == "Bizum")

        self.lbl_acc_sales.config(text=f"{total_sales:.2f} €")
        self.lbl_acc_cash.config(text=f"{total_cash:.2f} €")
        self.lbl_acc_bizum.config(text=f"{total_bizum:.2f} €")

    def get_selected_order(self):
        sel = self.tree_orders.selection()
        order_id = None
        if sel:
            try:
                order_id = str(self.tree_orders.item(sel[0])["values"][0])
            except Exception:
                pass
        if not order_id and self.last_selected_order_id:
            order_id = self.last_selected_order_id

        if not order_id:
            return None
        return next((o for o in self.orders if str(o.get("id")) == order_id), None)

    def mark_selected_delivered(self):
        order = self.get_selected_order()
        if not order:
            return messagebox.showwarning("Selección", "Por favor haz clic sobre un pedido en la lista para seleccionarlo.")

        order["status"] = "Entregado"
        self.render_orders()
        messagebox.showinfo("Éxito", f"Pedido {order.get('id')} marcado como ENTREGADO.")

    def open_selected_whatsapp(self):
        order = self.get_selected_order()
        if not order:
            return messagebox.showwarning("Selección", "Por favor haz clic sobre un pedido en la lista para seleccionarlo.")

        phone = str(order.get("phone", "")).replace("+", "").replace(" ", "")
        if phone:
            webbrowser.open(f"https://wa.me/{phone if phone.startswith('34') else '34' + phone}")

    def delete_selected_order(self):
        order = self.get_selected_order()
        if not order:
            return messagebox.showwarning("Selección", "Por favor selecciona un pedido de la lista para eliminar.")

        order_id = str(order.get("id"))
        if messagebox.askyesno("Eliminar Pedido", f"¿Deseas eliminar el pedido '{order_id}' de la lista y contabilidad?"):
            self.deleted_order_ids.add(order_id)
            self.orders = [o for o in self.orders if str(o.get("id")) != order_id]
            self.last_selected_order_id = None
            self.render_all()
            self.save_local_storage()

            def push_bg():
                payload_data = {"name": "ParceQueChimbaOrders", "data": {"orders": self.orders}}
                payload_bytes = json.dumps(payload_data).encode('utf-8')
                
                # 1. Borrar en la Nube
                try:
                    req = urllib.request.Request(CLOUD_URL, data=payload_bytes, headers={"Content-Type": "application/json"}, method="PUT")
                    urllib.request.urlopen(req, timeout=4)
                except Exception:
                    pass

                # 2. Borrar en el Servidor Bot Local
                try:
                    req_loc = urllib.request.Request(LOCAL_URL, data=json.dumps({"orders": self.orders}).encode('utf-8'), headers={"Content-Type": "application/json"}, method="POST")
                    urllib.request.urlopen(req_loc, timeout=3)
                except Exception:
                    pass

            threading.Thread(target=push_bg, daemon=True).start()
            messagebox.showinfo("Eliminado", f"Pedido {order_id} eliminado permanentemente.")

    def clear_all_accounting_history(self):
        if messagebox.askyesno("Confirmar Limpieza Total", "⚠️ ¿Seguro que deseas BORRAR TODOS los pedidos de prueba de la contabilidad?\n\nEsto dejará las ventas, caja y contabilidad en 0.00€ para iniciar el negocio en limpio."):
            for o in self.orders:
                if o.get("id"):
                    self.deleted_order_ids.add(str(o["id"]))

            self.orders = []
            self.known_order_ids.clear()
            self.last_selected_order_id = None
            self.render_all()
            self.save_local_storage()

            def push_bg():
                payload_data = {"name": "ParceQueChimbaOrders", "data": {"orders": []}}
                payload_bytes = json.dumps(payload_data).encode('utf-8')

                # 1. Borrar en la Nube
                try:
                    req = urllib.request.Request(CLOUD_URL, data=payload_bytes, headers={"Content-Type": "application/json"}, method="PUT")
                    urllib.request.urlopen(req, timeout=4)
                except Exception:
                    pass

                # 2. Borrar en el Servidor Bot Local
                try:
                    req_loc = urllib.request.Request(LOCAL_URL, data=json.dumps({"orders": []}).encode('utf-8'), headers={"Content-Type": "application/json"}, method="POST")
                    urllib.request.urlopen(req_loc, timeout=3)
                except Exception:
                    pass

            threading.Thread(target=push_bg, daemon=True).start()
            messagebox.showinfo("Contabilidad Reseteada", "¡Historial de contabilidad y pedidos reseteado a 0.00€ con éxito!")

    def send_promo_whatsapp(self):
        selected = self.tree_crm.selection()
        if not selected:
            return messagebox.showwarning("Selección", "Por favor selecciona un cliente de la lista.")
        
        vals = self.tree_crm.item(selected[0])["values"]
        phone = str(vals[0]).replace("+", "").replace(" ", "")
        name = str(vals[1])
        msg = urllib.parse.quote(f"¡Hola {name}! 🤠🔥 En Que Chimba Parce premiamos tu fidelidad. ¡Te regalamos la bebida en tu próximo pedido!")
        webbrowser.open(f"https://wa.me/{phone if phone.startswith('34') else '34' + phone}?text={msg}")

    def add_custom_stock_dialog(self):
        selected = self.tree_inv.selection()
        if not selected:
            return messagebox.showwarning("Selección", "Por favor selecciona un insumo de la lista para sumar stock.")

        vals = self.tree_inv.item(selected[0])["values"]
        item_id = str(vals[0])
        item_name = str(vals[1])
        item = next((i for i in self.inventory if i["id"] == item_id), None)
        if not item:
            return

        top = tk.Toplevel(self.root)
        top.title(f"Sumar Stock: {item_name}")
        top.geometry("360x220")
        top.configure(bg="#1e1e1e")
        top.transient(self.root)
        top.grab_set()

        tk.Label(top, text=f"📦 Sumar Unidades a:\n{item_name}", bg="#1e1e1e", fg="#f59e0b", font=("Segoe UI", 11, "bold")).pack(pady=12)

        f1 = tk.Frame(top, bg="#1e1e1e")
        f1.pack(pady=5)
        tk.Label(f1, text="Cantidad a Sumar:", bg="#1e1e1e", fg="white", font=("Segoe UI", 10)).pack(side="left")
        e_qty = tk.Entry(f1, font=("Segoe UI", 11), width=10, justify="center")
        e_qty.insert(0, "10")
        e_qty.pack(side="left", padx=8)

        def save_added():
            try:
                val = int(e_qty.get())
                if val <= 0:
                    return messagebox.showerror("Error", "Ingresa una cantidad mayor a 0.")
                item["stock"] += val
                self.render_inventory()
                self.save_local_storage()
                top.destroy()
                messagebox.showinfo("Éxito", f"¡Se sumaron +{val} {item.get('unit','unidades')} a '{item_name}'!\nNuevo Stock: {item['stock']}")
            except ValueError:
                messagebox.showerror("Error", "Por favor ingresa un número entero válido.")

        tk.Button(top, text="➕ Sumar al Stock", bg="#10b981", fg="white", font=("Segoe UI", 10, "bold"), command=save_added).pack(pady=16)

    def adjust_stock(self, delta):
        selected = self.tree_inv.selection()
        if not selected:
            return messagebox.showwarning("Selección", "Por favor selecciona un insumo del inventario.")
        
        item_id = str(self.tree_inv.item(selected[0])["values"][0])
        for i in self.inventory:
            if i["id"] == item_id:
                i["stock"] = max(0, i["stock"] + delta)
                break

        self.render_inventory()
        self.save_local_storage()

    def reset_all_stock_to_zero(self):
        if messagebox.askyesno("Confirmar Reset", "¿Deseas poner el stock de TODOS los insumos a 0 para ingresar existencias desde cero?"):
            for i in self.inventory:
                i["stock"] = 0
            self.render_inventory()
            self.save_local_storage()
            messagebox.showinfo("Stock Reseteado", "¡Todo el stock se ha puesto a 0 con éxito!")

    def edit_selected_inventory(self):
        selected = self.tree_inv.selection()
        if not selected:
            return messagebox.showwarning("Selección", "Por favor selecciona un insumo de la lista para editar.")

        item_id = str(self.tree_inv.item(selected[0])["values"][0])
        item = next((i for i in self.inventory if i["id"] == item_id), None)
        if not item:
            return

        top = tk.Toplevel(self.root)
        top.title(f"Modificar Insumo: {item['name']}")
        top.geometry("380x320")
        top.configure(bg="#1e1e1e")
        top.transient(self.root)
        top.grab_set()

        tk.Label(top, text=f"📦 Modificar: {item['name']}", bg="#1e1e1e", fg="#f59e0b", font=("Segoe UI", 11, "bold")).pack(pady=12)

        f1 = tk.Frame(top, bg="#1e1e1e")
        f1.pack(pady=5)
        tk.Label(f1, text="Stock Actual:", bg="#1e1e1e", fg="white", width=16, anchor="e", font=("Segoe UI", 10)).pack(side="left")
        e_stock = tk.Entry(f1, font=("Segoe UI", 10), width=12)
        e_stock.insert(0, str(item.get("stock", 0)))
        e_stock.pack(side="left", padx=5)

        f2 = tk.Frame(top, bg="#1e1e1e")
        f2.pack(pady=5)
        tk.Label(f2, text="Costo Unitario (€):", bg="#1e1e1e", fg="white", width=16, anchor="e", font=("Segoe UI", 10)).pack(side="left")
        e_cost = tk.Entry(f2, font=("Segoe UI", 10), width=12)
        e_cost.insert(0, str(item.get("unitCost", 1.00)))
        e_cost.pack(side="left", padx=5)

        f3 = tk.Frame(top, bg="#1e1e1e")
        f3.pack(pady=5)
        tk.Label(f3, text="Alerta Mínima:", bg="#1e1e1e", fg="white", width=16, anchor="e", font=("Segoe UI", 10)).pack(side="left")
        e_min = tk.Entry(f3, font=("Segoe UI", 10), width=12)
        e_min.insert(0, str(item.get("min", 5)))
        e_min.pack(side="left", padx=5)

        def save_changes():
            try:
                item["stock"] = max(0, int(e_stock.get()))
                item["unitCost"] = max(0.0, float(e_cost.get()))
                item["min"] = max(0, int(e_min.get()))
                self.render_inventory()
                self.save_local_storage()
                top.destroy()
                messagebox.showinfo("Éxito", f"Insumo '{item['name']}' actualizado correctamente.")
            except ValueError:
                messagebox.showerror("Error", "Por favor ingresa números válidos.")

        tk.Button(top, text="💾 Guardar Cambios", bg="#10b981", fg="white", font=("Segoe UI", 10, "bold"), command=save_changes).pack(pady=16)

    def add_new_inventory_dialog(self):
        top = tk.Toplevel(self.root)
        top.title("➕ Agregar Insumo Nuevo al Inventario")
        top.geometry("400x380")
        top.configure(bg="#1e1e1e")
        top.transient(self.root)
        top.grab_set()

        tk.Label(top, text="📦 Agregar Insumo Nuevo", bg="#1e1e1e", fg="#f59e0b", font=("Segoe UI", 12, "bold")).pack(pady=12)

        f1 = tk.Frame(top, bg="#1e1e1e")
        f1.pack(pady=4)
        tk.Label(f1, text="Nombre Insumo:", bg="#1e1e1e", fg="white", width=16, anchor="e").pack(side="left")
        e_name = tk.Entry(f1, font=("Segoe UI", 10), width=18)
        e_name.pack(side="left", padx=5)

        f2 = tk.Frame(top, bg="#1e1e1e")
        f2.pack(pady=4)
        tk.Label(f2, text="Categoría:", bg="#1e1e1e", fg="white", width=16, anchor="e").pack(side="left")
        cb_cat = ttk.Combobox(f2, values=["Carnes", "Panes", "Bebidas", "Insumos"], width=16, state="readonly")
        cb_cat.set("Carnes")
        cb_cat.pack(side="left", padx=5)

        f3 = tk.Frame(top, bg="#1e1e1e")
        f3.pack(pady=4)
        tk.Label(f3, text="Stock Inicial:", bg="#1e1e1e", fg="white", width=16, anchor="e").pack(side="left")
        e_stock = tk.Entry(f3, font=("Segoe UI", 10), width=18)
        e_stock.insert(0, "0")
        e_stock.pack(side="left", padx=5)

        f4 = tk.Frame(top, bg="#1e1e1e")
        f4.pack(pady=4)
        tk.Label(f4, text="Costo Unitario (€):", bg="#1e1e1e", fg="white", width=16, anchor="e").pack(side="left")
        e_cost = tk.Entry(f4, font=("Segoe UI", 10), width=18)
        e_cost.insert(0, "1.00")
        e_cost.pack(side="left", padx=5)

        f5 = tk.Frame(top, bg="#1e1e1e")
        f5.pack(pady=4)
        tk.Label(f5, text="Alerta Mínima:", bg="#1e1e1e", fg="white", width=16, anchor="e").pack(side="left")
        e_min = tk.Entry(f5, font=("Segoe UI", 10), width=18)
        e_min.insert(0, "5")
        e_min.pack(side="left", padx=5)

        f6 = tk.Frame(top, bg="#1e1e1e")
        f6.pack(pady=4)
        tk.Label(f6, text="Unidad:", bg="#1e1e1e", fg="white", width=16, anchor="e").pack(side="left")
        cb_unit = ttk.Combobox(f6, values=["unidades", "kg", "latas", "raciones"], width=16, state="readonly")
        cb_unit.set("unidades")
        cb_unit.pack(side="left", padx=5)

        def save_new():
            name = e_name.get().strip()
            if not name:
                return messagebox.showerror("Error", "Ingresa un nombre para el insumo.")
            try:
                stock_val = max(0, int(e_stock.get()))
                cost_val = max(0.0, float(e_cost.get()))
                min_val = max(0, int(e_min.get()))

                new_item = {
                    "id": f"inv_{int(time.time())}",
                    "name": name,
                    "category": cb_cat.get(),
                    "stock": stock_val,
                    "min": min_val,
                    "unitCost": cost_val,
                    "unit": cb_unit.get()
                }
                self.inventory.append(new_item)
                self.render_inventory()
                self.save_local_storage()
                top.destroy()
                messagebox.showinfo("Éxito", f"Insumo '{name}' agregado con {stock_val} {cb_unit.get()}!")
            except ValueError:
                messagebox.showerror("Error", "Ingresa valores numéricos válidos en Stock, Costo y Alerta Mínima.")

        tk.Button(top, text="➕ Agregar Insumo", bg="#10b981", fg="white", font=("Segoe UI", 10, "bold"), command=save_new).pack(pady=16)

    def delete_selected_inventory(self):
        selected = self.tree_inv.selection()
        if not selected:
            return messagebox.showwarning("Selección", "Por favor selecciona un insumo de la lista para eliminar.")

        vals = self.tree_inv.item(selected[0])["values"]
        item_id = str(vals[0])
        item_name = str(vals[1])

        if messagebox.askyesno("Eliminar Insumo", f"¿Seguro que deseas eliminar '{item_name}' del inventario?"):
            self.inventory = [i for i in self.inventory if i["id"] != item_id]
            self.render_inventory()
            self.save_local_storage()
            messagebox.showinfo("Eliminado", f"Insumo '{item_name}' eliminado.")

    # --- PESTAÑA Y LÓGICA DE REPARTIDORES & DOMICILIOS ---
    def build_tab_drivers(self):
        top_bar = tk.Frame(self.tab_drivers, bg="#121212")
        top_bar.pack(fill="x", pady=6)

        lbl_drv_title = tk.Label(top_bar, text="🛵 Registro y Liquidación de Repartidores (2.00€ por Envío)", bg="#121212", fg="#f59e0b", font=("Segoe UI", 12, "bold"))
        lbl_drv_title.pack(side="left")

        columns = ("name", "phone", "active", "delivered", "payout")
        self.tree_drivers = ttk.Treeview(self.tab_drivers, columns=columns, show="headings", height=14)

        self.tree_drivers.heading("name", text="Nombre Repartidor")
        self.tree_drivers.heading("phone", text="Teléfono WhatsApp")
        self.tree_drivers.heading("active", text="Entregas Activas")
        self.tree_drivers.heading("delivered", text="Total Entregados")
        self.tree_drivers.heading("payout", text="Pendiente Liquidar (€)")

        self.tree_drivers.column("name", width=200)
        self.tree_drivers.column("phone", width=140, anchor="center")
        self.tree_drivers.column("active", width=120, anchor="center")
        self.tree_drivers.column("delivered", width=120, anchor="center")
        self.tree_drivers.column("payout", width=160, anchor="center")

        self.tree_drivers.pack(fill="both", expand=True, pady=6)

        action_bar = tk.Frame(self.tab_drivers, bg="#121212")
        action_bar.pack(fill="x", pady=6)

        btn_add_drv = tk.Button(action_bar, text="➕ Agregar Repartidor", bg="#10b981", fg="white", font=("Segoe UI", 10, "bold"), command=self.add_new_driver_dialog)
        btn_add_drv.pack(side="left", padx=5)

        btn_settle = tk.Button(action_bar, text="💰 Liquidar PAGO a Repartidor", bg="#f59e0b", fg="black", font=("Segoe UI", 10, "bold"), command=self.settle_driver_payout)
        btn_settle.pack(side="left", padx=5)

        btn_del_drv = tk.Button(action_bar, text="🗑️ Eliminar Repartidor", bg="#ef4444", fg="white", font=("Segoe UI", 10, "bold"), command=self.delete_selected_driver)
        btn_del_drv.pack(side="left", padx=5)

        self.render_drivers()

    def render_drivers(self):
        for item in self.tree_drivers.get_children():
            self.tree_drivers.delete(item)

        for d in self.drivers:
            dname = d["name"]
            active_count = len([o for o in self.orders if o.get("assignedDriver") == dname and o.get("status") == "En Camino"])
            delivered_count = len([o for o in self.orders if o.get("assignedDriver") == dname and o.get("status") == "Entregado"])
            unsettled_count = len([o for o in self.orders if o.get("assignedDriver") == dname and o.get("status") == "Entregado" and not o.get("isSettled")])
            pending_payout = unsettled_count * 2.00

            self.tree_drivers.insert("", "end", values=(
                dname,
                d.get("phone", ""),
                active_count,
                delivered_count,
                f"{pending_payout:.2f} € ({unsettled_count} envíos)"
            ))

    def add_new_driver_dialog(self):
        top = tk.Toplevel(self.root)
        top.title("➕ Registrar Nuevo Repartidor")
        top.geometry("380x250")
        top.configure(bg="#1e1e1e")
        top.transient(self.root)
        top.grab_set()

        tk.Label(top, text="🛵 Registro de Repartidor", bg="#1e1e1e", fg="#f59e0b", font=("Segoe UI", 11, "bold")).pack(pady=12)

        f1 = tk.Frame(top, bg="#1e1e1e")
        f1.pack(pady=5)
        tk.Label(f1, text="Nombre Repartidor:", bg="#1e1e1e", fg="white", width=16, anchor="e").pack(side="left")
        e_name = tk.Entry(f1, font=("Segoe UI", 10), width=18)
        e_name.pack(side="left", padx=5)

        f2 = tk.Frame(top, bg="#1e1e1e")
        f2.pack(pady=5)
        tk.Label(f2, text="Teléfono WhatsApp:", bg="#1e1e1e", fg="white", width=16, anchor="e").pack(side="left")
        e_phone = tk.Entry(f2, font=("Segoe UI", 10), width=18)
        e_phone.insert(0, "34600000000")
        e_phone.pack(side="left", padx=5)

        def save_drv():
            name = e_name.get().strip()
            phone = e_phone.get().strip()
            if not name or not phone:
                return messagebox.showerror("Error", "Ingresa Nombre y Teléfono del repartidor.")
            new_d = {"id": f"d_{int(time.time())}", "name": name, "phone": phone}
            self.drivers.append(new_d)
            self.render_drivers()
            self.save_local_storage()
            top.destroy()
            messagebox.showinfo("Éxito", f"Repartidor '{name}' agregado con éxito.")

        tk.Button(top, text="💾 Guardar Repartidor", bg="#10b981", fg="white", font=("Segoe UI", 10, "bold"), command=save_drv).pack(pady=16)

    def delete_selected_driver(self):
        selected = self.tree_drivers.selection()
        if not selected:
            return messagebox.showwarning("Selección", "Por favor selecciona un repartidor para eliminar.")
        
        vals = self.tree_drivers.item(selected[0])["values"]
        dname = str(vals[0])
        if messagebox.askyesno("Eliminar Repartidor", f"¿Deseas eliminar a '{dname}' de la lista de repartidores?"):
            self.drivers = [d for d in self.drivers if d["name"] != dname]
            self.render_drivers()
            self.save_local_storage()

    def settle_driver_payout(self):
        selected = self.tree_drivers.selection()
        if not selected:
            return messagebox.showwarning("Selección", "Por favor selecciona un repartidor para liquidar su pago.")

        vals = self.tree_drivers.item(selected[0])["values"]
        dname = str(vals[0])
        unsettled_orders = [o for o in self.orders if o.get("assignedDriver") == dname and o.get("status") == "Entregado" and not o.get("isSettled")]
        
        if not unsettled_orders:
            return messagebox.showinfo("Sin Saldo", f"'{dname}' no tiene envíos pendientes por liquidar.")

        total_due = len(unsettled_orders) * 2.00
        if messagebox.askyesno("Liquidar Pago", f"¿PAGAR {total_due:.2f}€ a '{dname}' por {len(unsettled_orders)} envíos completados?"):
            for o in unsettled_orders:
                o["isSettled"] = True
            self.render_drivers()
            self.save_local_storage()
            messagebox.showinfo("Liquidación Completada", f"¡Se liquidó {total_due:.2f}€ a {dname} con éxito!")

    def create_manual_order_dialog(self):
        top = tk.Toplevel(self.root)
        top.title("➕ Crear Pedido Manual (Llamada / WhatsApp Directo)")
        top.geometry("440x450")
        top.configure(bg="#1e1e1e")
        top.transient(self.root)
        top.grab_set()

        tk.Label(top, text="📞 Nuevo Pedido Manual (Llamada / Wpp)", bg="#1e1e1e", fg="#f59e0b", font=("Segoe UI", 12, "bold")).pack(pady=12)

        f1 = tk.Frame(top, bg="#1e1e1e")
        f1.pack(pady=3)
        tk.Label(f1, text="Nombre Cliente:", bg="#1e1e1e", fg="white", width=16, anchor="e").pack(side="left")
        e_name = tk.Entry(f1, font=("Segoe UI", 10), width=22)
        e_name.pack(side="left", padx=5)

        f2 = tk.Frame(top, bg="#1e1e1e")
        f2.pack(pady=3)
        tk.Label(f2, text="Teléfono:", bg="#1e1e1e", fg="white", width=16, anchor="e").pack(side="left")
        e_phone = tk.Entry(f2, font=("Segoe UI", 10), width=22)
        e_phone.insert(0, "34600000000")
        e_phone.pack(side="left", padx=5)

        f3 = tk.Frame(top, bg="#1e1e1e")
        f3.pack(pady=3)
        tk.Label(f3, text="Dirección Entrega:", bg="#1e1e1e", fg="white", width=16, anchor="e").pack(side="left")
        e_addr = tk.Entry(f3, font=("Segoe UI", 10), width=22)
        e_addr.insert(0, "Calle ")
        e_addr.pack(side="left", padx=5)

        f4 = tk.Frame(top, bg="#1e1e1e")
        f4.pack(pady=3)
        tk.Label(f4, text="Detalle Platos / Notas:", bg="#1e1e1e", fg="white", width=16, anchor="e").pack(side="left")
        e_notes = tk.Entry(f4, font=("Segoe UI", 10), width=22)
        e_notes.insert(0, "1x Hamburguesa Paisa, 1x Postobón")
        e_notes.pack(side="left", padx=5)

        f5 = tk.Frame(top, bg="#1e1e1e")
        f5.pack(pady=3)
        tk.Label(f5, text="Total (€):", bg="#1e1e1e", fg="white", width=16, anchor="e").pack(side="left")
        e_total = tk.Entry(f5, font=("Segoe UI", 10), width=22)
        e_total.insert(0, "14.50")
        e_total.pack(side="left", padx=5)

        f6 = tk.Frame(top, bg="#1e1e1e")
        f6.pack(pady=3)
        tk.Label(f6, text="Método de Pago:", bg="#1e1e1e", fg="white", width=16, anchor="e").pack(side="left")
        cb_pay = ttk.Combobox(f6, values=["Efectivo", "Bizum"], width=20, state="readonly")
        cb_pay.set("Efectivo")
        cb_pay.pack(side="left", padx=5)

        f7 = tk.Frame(top, bg="#1e1e1e")
        f7.pack(pady=3)
        tk.Label(f7, text="Asignar Repartidor:", bg="#1e1e1e", fg="white", width=16, anchor="e").pack(side="left")
        drv_names = [d["name"] for d in self.drivers]
        cb_drv = ttk.Combobox(f7, values=["❌ Sin Asignar"] + drv_names, width=20, state="readonly")
        cb_drv.set("❌ Sin Asignar")
        cb_drv.pack(side="left", padx=5)

        def save_manual():
            cname = e_name.get().strip() or "Cliente Manual"
            cphone = e_phone.get().strip() or "Sin Teléfono"
            caddr = e_addr.get().strip() or "Local"
            cnotes = e_notes.get().strip()
            drv_sel = cb_drv.get()
            if drv_sel == "❌ Sin Asignar":
                drv_sel = None

            try:
                tot_val = float(e_total.get())
            except ValueError:
                tot_val = 10.00

            now = datetime.now()
            order_id = f"#PQ-M{int(time.time()) % 100000}"

            new_order = {
                "id": order_id,
                "clientName": cname,
                "phone": cphone,
                "address": caddr,
                "notes": cnotes,
                "items": [{"name": cnotes, "price": tot_val, "quantity": 1}],
                "total": tot_val,
                "paymentMethod": cb_pay.get(),
                "status": "En Camino" if drv_sel else "En Preparación",
                "assignedDriver": drv_sel,
                "timeStr": now.strftime("%H:%M"),
                "dateStr": now.strftime("%d/%m/%Y"),
                "isoDateStr": now.strftime("%Y-%m-%d")
            }

            self.orders.insert(0, new_order)
            self.render_orders()

            def push_bg():
                try:
                    payload_bytes = json.dumps({"name": "ParceQueChimbaOrders", "data": {"orders": self.orders}}).encode('utf-8')
                    req = urllib.request.Request(CLOUD_URL, data=payload_bytes, headers={"Content-Type": "application/json"}, method="PUT")
                    urllib.request.urlopen(req, timeout=4)
                except Exception:
                    pass
            threading.Thread(target=push_bg, daemon=True).start()

            top.destroy()
            messagebox.showinfo("Pedido Creado", f"Pedido {order_id} registrado con éxito.")

            if drv_sel:
                drv_obj = next((d for d in self.drivers if d["name"] == drv_sel), None)
                if drv_obj:
                    self.send_driver_whatsapp(new_order, drv_obj)

        tk.Button(top, text="🚀 Registrar Pedido", bg="#f59e0b", fg="black", font=("Segoe UI", 11, "bold"), command=save_manual).pack(pady=16)

    def confirm_and_notify_both_dialog(self):
        order = self.get_selected_order()
        if not order:
            return messagebox.showwarning("Selección", "Por favor haz clic sobre un pedido en la lista para seleccionarlo.")

        order_id = str(order.get("id"))
        client_name = order.get("clientName", "Cliente")
        client_phone = str(order.get("phone", "")).replace("+", "").replace(" ", "")

        top = tk.Toplevel(self.root)
        top.title(f"Confirmar Pedido {order_id} y Despachar")
        top.geometry("440x320")
        top.configure(bg="#1e1e1e")
        top.transient(self.root)
        top.grab_set()

        tk.Label(top, text=f"🚀 Despacho y Notificaciones de Pedido {order_id}", bg="#1e1e1e", fg="#f59e0b", font=("Segoe UI", 11, "bold")).pack(pady=12)

        f1 = tk.Frame(top, bg="#1e1e1e")
        f1.pack(pady=6)
        tk.Label(f1, text="Asignar Repartidor:", bg="#1e1e1e", fg="white", width=18, anchor="e").pack(side="left")
        drv_names = [d["name"] for d in self.drivers]
        cb_drv = ttk.Combobox(f1, values=drv_names, width=20, state="readonly")
        if drv_names:
            cb_drv.set(drv_names[0])
        cb_drv.pack(side="left", padx=5)

        var_notify_client = tk.BooleanVar(value=True)
        var_notify_driver = tk.BooleanVar(value=True)

        chk1 = tk.Checkbutton(top, text=f"💬 Notificar Confirmación a Cliente ({client_name})", variable=var_notify_client, bg="#1e1e1e", fg="#10b981", selectcolor="#2a2a2a", font=("Segoe UI", 9, "bold"))
        chk1.pack(anchor="w", padx=30, pady=4)

        chk2 = tk.Checkbutton(top, text="🛵 Enviar Ficha de Domicilio al Repartidor por WhatsApp", variable=var_notify_driver, bg="#1e1e1e", fg="#3b82f6", selectcolor="#2a2a2a", font=("Segoe UI", 9, "bold"))
        chk2.pack(anchor="w", padx=30, pady=4)

        def execute_dispatch():
            drv_sel = cb_drv.get()
            if not drv_sel:
                return messagebox.showerror("Error", "Selecciona un repartidor.")

            order["assignedDriver"] = drv_sel
            order["status"] = "En Camino"
            self.render_orders()

            def push_bg():
                try:
                    payload_bytes = json.dumps({"name": "ParceQueChimbaOrders", "data": {"orders": self.orders}}).encode('utf-8')
                    req = urllib.request.Request(CLOUD_URL, data=payload_bytes, headers={"Content-Type": "application/json"}, method="PUT")
                    urllib.request.urlopen(req, timeout=4)
                except Exception:
                    pass
            threading.Thread(target=push_bg, daemon=True).start()

            top.destroy()

            if var_notify_client.get() and client_phone:
                clean_cphone = client_phone if client_phone.startswith("34") else "34" + client_phone
                cmsg = (
                    f"¡Hola {client_name}! 🤠🔥\n\n"
                    f"Tu pedido *{order_id}* en *Que Chimba Parce* ha sido *CONFIRMADO* y está en camino con nuestro repartidor *{drv_sel}*. 🛵🍔\n\n"
                    f"💰 *Total a pagar:* {order.get('total', 0):.2f}€ ({order.get('paymentMethod', 'Efectivo')})\n"
                    f"🏠 *Dirección:* {order.get('address', '')}\n\n"
                    f"¡Gracias por preferir el auténtico sabor colombiano! 🇨🇴"
                )
                webbrowser.open(f"https://wa.me/{clean_cphone}?text={urllib.parse.quote(cmsg)}")

            if var_notify_driver.get():
                drv_obj = next((d for d in self.drivers if d["name"] == drv_sel), None)
                if drv_obj:
                    if var_notify_client.get() and client_phone:
                        self.root.after(1200, lambda: self.send_driver_whatsapp(order, drv_obj))
                    else:
                        self.send_driver_whatsapp(order, drv_obj)

        tk.Button(top, text="🚀 CONFIRMAR Y DESPACHAR AHORA", bg="#f59e0b", fg="black", font=("Segoe UI", 11, "bold"), command=execute_dispatch).pack(pady=16)

    def assign_driver_to_order_dialog(self):
        order = self.get_selected_order()
        if not order:
            return messagebox.showwarning("Selección", "Por favor haz clic sobre un pedido en la tabla para seleccionarlo.")

        order_id = str(order.get("id"))

        top = tk.Toplevel(self.root)
        top.title(f"Asignar Repartidor a Pedido {order_id}")
        top.geometry("380x230")
        top.configure(bg="#1e1e1e")
        top.transient(self.root)
        top.grab_set()

        tk.Label(top, text=f"🛵 Asignar Repartidor a Pedido {order_id}", bg="#1e1e1e", fg="#f59e0b", font=("Segoe UI", 11, "bold")).pack(pady=12)

        f1 = tk.Frame(top, bg="#1e1e1e")
        f1.pack(pady=8)
        tk.Label(f1, text="Seleccionar Repartidor:", bg="#1e1e1e", fg="white").pack(side="left", padx=5)
        drv_names = [d["name"] for d in self.drivers]
        cb_drv = ttk.Combobox(f1, values=drv_names, width=22, state="readonly")
        if drv_names:
            cb_drv.set(drv_names[0])
        cb_drv.pack(side="left", padx=5)

        def save_assignment():
            drv_sel = cb_drv.get()
            if not drv_sel:
                return messagebox.showerror("Error", "Selecciona un repartidor.")

            order["assignedDriver"] = drv_sel
            order["status"] = "En Camino"
            self.render_orders()

            def push_bg():
                try:
                    payload_bytes = json.dumps({"name": "ParceQueChimbaOrders", "data": {"orders": self.orders}}).encode('utf-8')
                    req = urllib.request.Request(CLOUD_URL, data=payload_bytes, headers={"Content-Type": "application/json"}, method="PUT")
                    urllib.request.urlopen(req, timeout=4)
                except Exception:
                    pass
            threading.Thread(target=push_bg, daemon=True).start()

            top.destroy()
            drv_obj = next((d for d in self.drivers if d["name"] == drv_sel), None)
            if drv_obj:
                self.send_driver_whatsapp(order, drv_obj)

        tk.Button(top, text="💬 Confirmar y Enviar por WhatsApp", bg="#25D366", fg="white", font=("Segoe UI", 10, "bold"), command=save_assignment).pack(pady=16)

    def send_driver_whatsapp_notification(self):
        order = self.get_selected_order()
        if not order:
            return messagebox.showwarning("Selección", "Por favor haz clic sobre un pedido en la tabla para seleccionarlo.")

        order_id = str(order.get("id"))

        drv_name = order.get("assignedDriver")
        if not drv_name:
            return messagebox.showwarning("Sin Repartidor", "Este pedido aún no tiene repartidor asignado. Haz clic en '🛵 Confirmar y Asignar Repartidor'.")

        drv_obj = next((d for d in self.drivers if d["name"] == drv_name), None)
        if not drv_obj:
            return messagebox.showerror("Error", "No se encontró el teléfono del repartidor.")

        self.send_driver_whatsapp(order, drv_obj)

    def send_driver_whatsapp(self, order, driver_obj):
        phone = driver_obj.get("phone", "").replace("+", "").replace(" ", "")
        if not phone:
            return messagebox.showerror("Error", "El repartidor no tiene número de teléfono registrado.")

        clean_phone = phone if phone.startswith("34") else "34" + phone
        client_name = order.get("clientName", "Cliente")
        client_phone = order.get("phone", "No especificado")
        address = order.get("address", "Dirección no especificada")
        total = order.get("total", 0.0)
        pay_method = order.get("paymentMethod", "Efectivo")
        notes = order.get("notes", "")

        msg = (
            f"🛵 *NUEVO DOMICILIO ASIGNADO* 📦\n\n"
            f"🆔 *Pedido:* {order.get('id')}\n"
            f"👤 *Cliente:* {client_name}\n"
            f"📱 *Teléfono Cliente:* {client_phone}\n"
            f"🏠 *Dirección Entrega:* {address}\n"
            f"{f'📝 *Notas:* {notes}\n' if notes else ''}"
            f"💰 *TOTAL A COBRAR:* {total:.2f}€ ({pay_method})\n"
            f"💸 *Tu Comisión por Envío:* 2.00€\n\n"
            f"⚡ *¡Por favor confirma recibido para entregar caliente!* 🔥"
        )

        webbrowser.open(f"https://wa.me/{clean_phone}?text={urllib.parse.quote(msg)}")

    def export_csv(self):
        try:
            filename = f"Libro_Contable_ParceQueChimba_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            with open(filename, mode="w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow(["ID Pedido", "Hora", "Cliente", "Teléfono", "Dirección", "Total (€)", "Método Pago", "Estado"])
                for o in self.orders:
                    writer.writerow([
                        o.get("id", ""),
                        o.get("timeStr", ""),
                        o.get("clientName", ""),
                        o.get("phone", ""),
                        o.get("address", ""),
                        o.get("total", 0),
                        o.get("paymentMethod", ""),
                        o.get("status", "")
                    ])
            messagebox.showinfo("Exportación Exitosa", f"Archivo contable guardado como:\n{filename}")
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo guardar el archivo: {e}")

    def load_local_storage(self):
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    d = json.load(f)
                    if "inventory" in d:
                        self.inventory = d["inventory"]
                    if "drivers" in d:
                        self.drivers = d["drivers"]
                    if "deleted_ids" in d and isinstance(d["deleted_ids"], list):
                        self.deleted_order_ids.update(d["deleted_ids"])
            except Exception:
                pass

    def save_local_storage(self):
        try:
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                data_to_save = {
                    "inventory": self.inventory,
                    "drivers": self.drivers,
                    "deleted_ids": list(self.deleted_order_ids)
                }
                json.dump(data_to_save, f, ensure_ascii=False, indent=2)
        except Exception:
            pass


if __name__ == "__main__":
    root = tk.Tk()
    app = ParceQueChimbaCRM(root)
    root.mainloop()
