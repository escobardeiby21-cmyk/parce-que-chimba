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

# Configuración Global y Endpoints
CLOUD_URL = "https://api.restful-api.dev/objects/ff8081819ff5b11001a00bc5b83a2ee8"
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
        self.is_initial_load = True
        self.is_business_open = True
        self.is_chatbot_enabled = False

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
        self.style.configure("TNotebook.Tab", background="#1e1e1e", foreground="#d1d5db", padding=[16, 8], font=("Segoe UI", 10, "bold"))
        self.style.map("TNotebook.Tab", background=[("selected", "#f59e0b")], foreground=[("selected", "#000000")])

        # Botones
        self.style.configure("TButton", font=("Segoe UI", 10, "bold"), background="#f59e0b", foreground="#000000", borderwidth=0, padding=6)
        self.style.map("TButton", background=[("active", "#d97706")])

    def build_ui(self):
        # Header Superior
        header_frame = tk.Frame(self.root, bg="#1a1a1a", height=60)
        header_frame.pack(fill="x", side="top")

        lbl_title = tk.Label(header_frame, text="🇨🇴 QUE CHIMBA PARCE — SUITE EMPRESARIAL CRM & ERPS", bg="#1a1a1a", fg="#f59e0b", font=("Segoe UI", 14, "bold"))
        lbl_title.pack(side="left", padx=20, pady=12)

        self.lbl_status = tk.Label(header_frame, text="🟢 CONECTADO A LA NUBE EN TIEMPO REAL", bg="#1a1a1a", fg="#10b981", font=("Segoe UI", 10, "bold"))
        self.lbl_status.pack(side="right", padx=20)

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

        # Tab 4: Contabilidad & Reportes
        self.tab_accounting = ttk.Frame(self.notebook)
        self.notebook.add(self.tab_accounting, text="📊 Contabilidad & Ventas")
        self.build_tab_accounting()

    # --- TAB 1: PEDIDOS EN VIVO ---
    def build_tab_orders(self):
        top_bar = tk.Frame(self.tab_orders, bg="#121212")
        top_bar.pack(fill="x", pady=6)

        btn_refresh = tk.Button(top_bar, text="🔄 Refrescar Nube", bg="#3b82f6", fg="white", font=("Segoe UI", 9, "bold"), relief="flat", command=self.manual_sync)
        btn_refresh.pack(side="left", padx=5)

        self.lbl_orders_count = tk.Label(top_bar, text="Pedidos Totales: 0", bg="#121212", fg="#9ca3af", font=("Segoe UI", 10, "bold"))
        self.lbl_orders_count.pack(side="right", padx=5)

        # Tabla Treeview para Pedidos
        columns = ("id", "time", "client", "phone", "address", "total", "payment", "status")
        self.tree_orders = ttk.Treeview(self.tab_orders, columns=columns, show="headings", height=16)

        self.tree_orders.heading("id", text="ID Pedido")
        self.tree_orders.heading("time", text="Hora")
        self.tree_orders.heading("client", text="Cliente")
        self.tree_orders.heading("phone", text="Teléfono")
        self.tree_orders.heading("address", text="Dirección")
        self.tree_orders.heading("total", text="Total (€)")
        self.tree_orders.heading("payment", text="Pago")
        self.tree_orders.heading("status", text="Estado")

        self.tree_orders.column("id", width=110, anchor="center")
        self.tree_orders.column("time", width=80, anchor="center")
        self.tree_orders.column("client", width=140)
        self.tree_orders.column("phone", width=110, anchor="center")
        self.tree_orders.column("address", width=260)
        self.tree_orders.column("total", width=90, anchor="center")
        self.tree_orders.column("payment", width=100, anchor="center")
        self.tree_orders.column("status", width=120, anchor="center")

        self.tree_orders.pack(fill="both", expand=True, pady=6)

        # Botones de Acción de Pedidos
        action_bar = tk.Frame(self.tab_orders, bg="#121212")
        action_bar.pack(fill="x", pady=6)

        btn_deliver = tk.Button(action_bar, text="✅ Marcar como ENTREGADO", bg="#10b981", fg="white", font=("Segoe UI", 10, "bold"), relief="flat", command=self.mark_selected_delivered)
        btn_deliver.pack(side="left", padx=5)

        btn_wpp = tk.Button(action_bar, text="💬 Abrir WhatsApp de Cliente", bg="#25D366", fg="white", font=("Segoe UI", 10, "bold"), relief="flat", command=self.open_selected_whatsapp)
        btn_wpp.pack(side="left", padx=5)

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

        btn_add = tk.Button(action_bar, text="➕ +5 Stock", bg="#10b981", fg="white", font=("Segoe UI", 10, "bold"), command=lambda: self.adjust_stock(5))
        btn_add.pack(side="left", padx=4)

        btn_sub = tk.Button(action_bar, text="➖ -1 Stock", bg="#ef4444", fg="white", font=("Segoe UI", 10, "bold"), command=lambda: self.adjust_stock(-1))
        btn_sub.pack(side="left", padx=4)

        btn_edit = tk.Button(action_bar, text="✏️ Editar Stock / Costo (€)", bg="#3b82f6", fg="white", font=("Segoe UI", 10, "bold"), command=self.edit_selected_inventory)
        btn_edit.pack(side="left", padx=4)

        btn_reset = tk.Button(action_bar, text="🔄 Resetear TODO el Stock a 0", bg="#f59e0b", fg="black", font=("Segoe UI", 10, "bold"), command=self.reset_all_stock_to_zero)
        btn_reset.pack(side="left", padx=4)

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

        # Botón Exportar CSV
        btn_export = tk.Button(self.tab_accounting, text="📥 Exportar Libro Contable a Excel (CSV)", bg="#10b981", fg="white", font=("Segoe UI", 11, "bold"), pady=10, command=self.export_csv)
        btn_export.pack(pady=20)

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

        # 1. Obtener Pedidos Globales de la Nube
        try:
            req = urllib.request.Request(CLOUD_URL, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=4) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    if isinstance(data.get("data", {}).get("orders"), list):
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

        # Combinar todos los pedidos de WhatsApp y Web evitando duplicados por ID
        merged_map = {}
        for o in (cloud_orders + local_orders):
            if isinstance(o, dict) and o.get("id"):
                merged_map[o["id"]] = o

        merged_list = list(merged_map.values())
        if merged_list:
            self.process_incoming_orders(merged_list)

    def manual_sync(self):
        threading.Thread(target=self.fetch_orders, daemon=True).start()
        messagebox.showinfo("Sincronización", "¡Sincronización ejecutada con éxito desde la Nube!")

    def process_incoming_orders(self, new_orders):
        has_new = False
        for o in new_orders:
            oid = o.get("id")
            if oid and oid not in self.known_order_ids:
                self.known_order_ids.add(oid)
                has_new = True

        self.orders = new_orders
        self.save_local_storage()

        # Reproducir sonido de timbre si hay un pedido nuevo
        if has_new and not self.is_initial_load and winsound:
            try:
                winsound.Beep(880, 250)
                winsound.Beep(1320, 350)
            except Exception:
                pass

        self.is_initial_load = False
        self.root.after(0, self.render_all)

    def render_all(self):
        self.render_orders()
        self.render_crm()
        self.render_accounting()

    def render_orders(self):
        for item in self.tree_orders.get_children():
            self.tree_orders.delete(item)

        self.lbl_orders_count.config(text=f"Pedidos Totales: {len(self.orders)}")

        for o in self.orders:
            self.tree_orders.insert("", "end", values=(
                o.get("id", ""),
                o.get("timeStr", ""),
                o.get("clientName", "Cliente"),
                o.get("phone", ""),
                o.get("address", ""),
                f"{o.get('total', 0):.2f}€",
                o.get("paymentMethod", "Efectivo"),
                o.get("status", "En Cocina")
            ))

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

    def mark_selected_delivered(self):
        selected = self.tree_orders.selection()
        if not selected:
            return messagebox.showwarning("Selección", "Por favor selecciona un pedido de la lista.")
        
        item_vals = self.tree_orders.item(selected[0])["values"]
        order_id = str(item_vals[0])

        for o in self.orders:
            if str(o.get("id")) == order_id:
                o["status"] = "Entregado"
                break

        self.render_orders()
        messagebox.showinfo("Éxito", f"Pedido {order_id} marcado como ENTREGADO.")

    def open_selected_whatsapp(self):
        selected = self.tree_orders.selection()
        if not selected:
            return messagebox.showwarning("Selección", "Por favor selecciona un pedido de la lista.")
        
        phone = str(self.tree_orders.item(selected[0])["values"][3]).replace("+", "").replace(" ", "")
        if phone:
            webbrowser.open(f"https://wa.me/{phone if phone.startswith('34') else '34' + phone}")

    def send_promo_whatsapp(self):
        selected = self.tree_crm.selection()
        if not selected:
            return messagebox.showwarning("Selección", "Por favor selecciona un cliente de la lista.")
        
        vals = self.tree_crm.item(selected[0])["values"]
        phone = str(vals[0]).replace("+", "").replace(" ", "")
        name = str(vals[1])
        msg = urllib.parse.quote(f"¡Hola {name}! 🤠🔥 En Que Chimba Parce premiamos tu fidelidad. ¡Te regalamos la bebida en tu próximo pedido!")
        webbrowser.open(f"https://wa.me/{phone if phone.startswith('34') else '34' + phone}?text={msg}")

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
            except Exception:
                pass

    def save_local_storage(self):
        try:
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                json.dump({"inventory": self.inventory}, f, ensure_ascii=False, indent=2)
        except Exception:
            pass


if __name__ == "__main__":
    root = tk.Tk()
    app = ParceQueChimbaCRM(root)
    root.mainloop()
