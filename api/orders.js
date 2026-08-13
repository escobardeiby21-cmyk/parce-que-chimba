let memoryStore = {
  orders: [
    {
      "id": "WPP-5523",
      "source": "WhatsApp AI Bot 🤖",
      "clientName": "Cristiano Ronaldo",
      "phone": "+34 418400848",
      "address": "🏠 Las peñas 5",
      "paymentMethod": "Efectivo",
      "items": [
        { "name": "Hamburguesa Clásica", "price": 6, "desc": "Carne, bacon, queso, cebolla caramelizada, tomate, lechuga, ensalada y salsa de la casa." },
        { "name": "Postobón Colombiana", "price": 2.5 }
      ],
      "subtotal": 8.5,
      "deliveryFee": 2,
      "total": 10.5,
      "status": "En Preparación",
      "assignedDriver": null,
      "notes": "Sin cambios ni notas especiales",
      "timestamp": "2026-08-13T18:45:51.735Z",
      "dateStr": "13/8/2026",
      "isoDateStr": "2026-08-13"
    },
    {
      "id": "WPP-5524",
      "source": "WhatsApp AI Bot 🤖",
      "clientName": "Camila",
      "phone": "+34 612345678",
      "address": "📍 Calle Principal 12, 3ºB",
      "paymentMethod": "Efectivo",
      "items": [
        { "name": "Hamburguesa Parce Especial", "price": 8.5, "desc": "Doble carne, queso cheddar, bacon crujiente, salsas especiales." },
        { "name": "Empanadas de Carne (3 ud)", "price": 4.5 }
      ],
      "subtotal": 13,
      "deliveryFee": 2,
      "total": 15,
      "status": "En Preparación",
      "assignedDriver": null,
      "notes": "Pedido de Camila - Entregar caliente",
      "timestamp": "2026-08-13T18:40:00.000Z",
      "dateStr": "13/8/2026",
      "isoDateStr": "2026-08-13"
    }
  ],
  isOpen: true,
  lastUpdate: new Date().toISOString()
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      return res.status(200).json(memoryStore);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const incomingOrders = Array.isArray(body?.orders)
        ? body.orders
        : (Array.isArray(body?.data?.orders) ? body.data.orders : []);

      const isOpen = typeof body?.isOpen === 'boolean'
        ? body.isOpen
        : (typeof body?.data?.isOpen === 'boolean' ? body.data.isOpen : memoryStore.isOpen);

      if (incomingOrders.length > 0) {
        // Merge orders by ID to prevent accidental loss
        const existingMap = new Map(memoryStore.orders.map(o => [o.id, o]));
        incomingOrders.forEach(o => {
          if (o && o.id) {
            existingMap.set(o.id, o);
          }
        });
        memoryStore.orders = Array.from(existingMap.values());
      } else if (body?.forceReset === true) {
        memoryStore.orders = [];
      }

      memoryStore.isOpen = isOpen;
      memoryStore.lastUpdate = new Date().toISOString();

      return res.status(200).json(memoryStore);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
