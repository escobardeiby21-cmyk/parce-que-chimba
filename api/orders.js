let memoryStore = {
  orders: [
    {
      "id": "WPP-2240",
      "source": "WhatsApp GPS Bot 📍",
      "clientName": "Samuel",
      "phone": "277318102716618",
      "address": "📍 Ubicación GPS enviada por el cliente",
      "paymentMethod": "Efectivo",
      "items": [
        {
          "name": "Pedido por WhatsApp GPS",
          "price": 10,
          "quantity": 1
        }
      ],
      "subtotal": 10,
      "deliveryFee": 2,
      "total": 12,
      "status": "En Preparación",
      "assignedDriver": null,
      "notes": "Ubicación GPS recibida: https://maps.google.com/?q=39.48757553100586,-1.0957531929016113",
      "timestamp": "2026-08-13T12:32:08.888Z",
      "dateStr": "13/8/2026",
      "isoDateStr": "2026-08-13"
    },
    {
      "id": "WPP-1990",
      "source": "WhatsApp AI Bot 🤖",
      "clientName": "Maria Camila Herrera",
      "phone": "677394845",
      "address": "🏠 Donde la negra",
      "paymentMethod": "Efectivo",
      "items": [
        {
          "name": "Combo de Hamburguesa",
          "price": 9,
          "desc": "Carne, bacon, queso, cebolla caramelizada, lechuga, tomate, ensalada (INCLUYE PATATAS Y BEBIDA)."
        }
      ],
      "subtotal": 9,
      "deliveryFee": 2,
      "total": 11,
      "status": "En Preparación",
      "assignedDriver": null,
      "notes": "Alitas",
      "timestamp": "2026-08-13T18:32:45.599Z",
      "dateStr": "13/8/2026",
      "isoDateStr": "2026-08-13"
    },
    {
      "id": "WPP-8355",
      "source": "WhatsApp AI Bot 🤖",
      "clientName": "Pepito Pérez",
      "phone": "614460467",
      "address": "Plaza ayuntamiento 1",
      "paymentMethod": "Efectivo",
      "items": [
        {
          "name": "Hamburguesa Doble",
          "price": 8,
          "desc": "Doble carne, bacon, queso, cebolla caramelizada, tomate, lechuga, ensalada y salsa de la casa."
        }
      ],
      "subtotal": 8,
      "deliveryFee": 2,
      "total": 10,
      "status": "En Preparación",
      "assignedDriver": null,
      "notes": "Cambio de 50",
      "timestamp": "2026-08-13T18:19:55.991Z",
      "dateStr": "13/8/2026",
      "isoDateStr": "2026-08-13"
    }
  ],
  isOpen: true,
  lastUpdate: new Date().toISOString()
};

const CLOUD_STORE_URL = 'https://api.restful-api.dev/objects/ff8081819ff5b11001a00bc5b83a2ee8';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. Sincronizar primero desde la Nube Global Persistente
    try {
      const cloudRes = await fetch(CLOUD_STORE_URL);
      if (cloudRes && cloudRes.ok) {
        const cloudJson = await cloudRes.json();
        if (cloudJson && cloudJson.data) {
          const remoteOrders = Array.isArray(cloudJson.data.orders) ? cloudJson.data.orders : [];
          const existingMap = new Map(memoryStore.orders.map(o => [o.id, o]));
          remoteOrders.forEach(o => { if (o && o.id) existingMap.set(o.id, o); });
          memoryStore.orders = Array.from(existingMap.values());
          if (typeof cloudJson.data.isOpen === 'boolean') {
            memoryStore.isOpen = cloudJson.data.isOpen;
          }
        }
      }
    } catch(errCloud) {}

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

      // Guardar inmediatamente en la Nube Persistente Global para que TODOS los servidores Vercel lo vean
      try {
        await fetch(CLOUD_STORE_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: "ParceQueChimbaOrders",
            data: memoryStore
          })
        });
      } catch(errPush) {}

      return res.status(200).json(memoryStore);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
