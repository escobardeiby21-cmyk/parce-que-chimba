let memoryStore = {
  orders: [],
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
