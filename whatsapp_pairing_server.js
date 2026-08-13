import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, Buttons, List } = pkg;
import QRCode from 'qrcode';
import OpenAI from 'openai';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CLOUD_DB_URL = 'https://parcequechimba.com/api/orders';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

let currentQrDataUrl = null;
let isReady = false;

// Servidor Web para la Vinculación en Tiempo Real
const server = http.createServer(async (req, res) => {
  // Ruta API para consultar, actualizar o borrar pedidos en tiempo real
  if (req.url.includes('/api/orders') || req.url.includes('/cloud_orders.json')) {
    const localPath = path.join(process.cwd(), 'public', 'cloud_orders.json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (fs.existsSync(localPath)) {
        res.end(fs.readFileSync(localPath, 'utf8'));
      } else {
        res.end(JSON.stringify({ orders: [], isOpen: true }));
      }
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      let bodyStr = '';
      req.on('data', chunk => { bodyStr += chunk; });
      req.on('end', () => {
        try {
          const payload = bodyStr ? JSON.parse(bodyStr) : { orders: [], isOpen: true };
          fs.writeFileSync(localPath, JSON.stringify(payload, null, 2));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ordersCount: payload.orders ? payload.orders.length : 0 }));
        } catch(e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  if (isReady) {
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Bot - Conectado</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0a0a0a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
          .card { background: #141414; padding: 40px; border-radius: 24px; border: 2px solid #10b981; box-shadow: 0 0 50px rgba(16,185,129,0.3); }
          h1 { color: #10b981; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✅ ¡BOT DE IA ENLAZADO EXITOSAMENTE!</h1>
          <p>Tu WhatsApp oficial está 100% conectado y respondiendo a los clientes.</p>
          <p>Escuchando mensajes de voz 🎙️ y texto 💬 24/7</p>
        </div>
      </body>
      </html>
    `);
    return;
  }

  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Vincular WhatsApp AI - Que Chimba Parce</title>
      <meta http-equiv="refresh" content="2">
      <style>
        body { font-family: system-ui, sans-serif; background: #0b0f19; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
        .card { background: #161e2e; padding: 32px; border-radius: 24px; border: 1px solid #374151; box-shadow: 0 20px 40px rgba(0,0,0,0.6); max-width: 400px; width: 90%; }
        h2 { color: #f59e0b; margin-top: 0; }
        .qr-box { background: white; padding: 16px; border-radius: 16px; margin: 20px 0; display: inline-block; }
        img { width: 260px; height: 260px; display: block; }
        .status { font-size: 13px; color: #9ca3af; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>📱 Vincula tu WhatsApp AI</h2>
        <p style="font-size: 13px; color: #d1d5db;">Abre WhatsApp ➔ <strong>Dispositivos vinculados</strong> ➔ <strong>Vincular dispositivo</strong></p>
        
        <div class="qr-box">
          ${currentQrDataUrl ? `<img src="${currentQrDataUrl}" alt="QR Code" />` : '<p style="color:black; padding:40px;">Cargando Código QR...</p>'}
        </div>

        <div class="status">
          🔄 El código QR se actualiza en tiempo real automáticamente
        </div>
      </div>
    </body>
    </html>
  `);
});

server.listen(3333, () => {
  console.log('🌐 Servidor de Vinculación iniciado en http://localhost:3333');
});

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './whatsapp_session' }),
  authTimeoutMs: 120000,
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  }
});

client.on('qr', async (qr) => {
  currentQrDataUrl = await QRCode.toDataURL(qr, { margin: 2 });
  console.log('🔄 Nuevo QR generado en http://localhost:3333');
  
  try {
    const qrImagePath = path.join(process.cwd(), 'qr_whatsapp_bot.png');
    await QRCode.toFile(qrImagePath, qr, { width: 400 });
  } catch (err) {}
});

client.on('ready', () => {
  isReady = true;
  console.log('\n======================================================');
  console.log('✅ ¡BOT DE IA ENLAZADO Y ACTIVO 100% EN WHATSAPP!');
  console.log('🚀 Escuchando mensajes de Texto y Audios de Voz 24/7...');
  console.log('======================================================\n');
});

const SYSTEM_PROMPT = `
Eres QueChimbaBot AI, el asistente virtual oficial de Inteligencia Artificial del restaurante "Que Chimba Parce" 🇨🇴🇪🇸.
Atiendes a los clientes directamente por WhatsApp (mensajes de texto y notas de voz).

REGLAS DE ATENCIÓN OBLIGATORIAS:
1. Sé súper amable, alegre, educado y profesional con toque colombiano cálido ("¡Hola parce!").
2. REGLA DE DOMICILIO: Aclara siempre que el costo de envío a la puerta del cliente es de solo 2.00€ extra.
3. Si te preguntan por productos o precios, usa nuestra carta oficial:
   - Hamburguesas (Burger Clásica 6.00€, Doble Brutal 8.00€, Burger Paisa Brioche 10.00€, Combo Burger 9.00€)
   - Perros Colombianos (Perro Clásico 4.00€, Perro Especial Colombiano 6.50€, Perro Salvaje XL 8.50€)
   - Salchipapas XL (Tradicional 4.50€, Salchi Costi 8.00€, Salchi Paisa 9.00€, La Picosa 9.00€, Salchi Mixta 8.50€)
   - Alitas BBQ (4un 4.50€, 8un 8.00€, 12un 11.50€)
   - Bebidas (Postobón Colombiana, Manzana, Uva 2.50€, Coca-Cola 1.80€, Jugos Naturales 3.00€)
4. Pide los datos de entrega: Nombre completo, Dirección exacta y Método de pago (Efectivo o Bizum).
5. Cuando el cliente confirme la orden, genera un resumen formateado claro con el Total + los 2.00€ de domicilio.
`;

const REMOTE_API_URL = 'https://www.parcequechimba.com/api/orders';

async function pushOrderToCloud(newOrder) {
  try {
    const localPath = path.join(process.cwd(), 'public', 'cloud_orders.json');
    let existingOrders = [];
    let isOpen = true;

    // 1. Leer pedidos locales primero
    if (fs.existsSync(localPath)) {
      try {
        const raw = fs.readFileSync(localPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.orders)) existingOrders = parsed.orders;
        if (parsed.isOpen !== undefined) isOpen = parsed.isOpen;
      } catch (e) {}
    }

    if (!existingOrders.some(o => o.id === newOrder.id)) {
      existingOrders.unshift(newOrder);

      // 2. Guardar copia local en public/cloud_orders.json
      try {
        fs.writeFileSync(localPath, JSON.stringify({ orders: existingOrders, isOpen }, null, 2));
        console.log(`✅ ¡PEDIDO GUARDADO LOCALMENTE EN DISCO!: ${newOrder.id}`);
      } catch (e) {}

      // 3. Enviar a Servidor Remoto /api/orders
      try {
        await fetch(REMOTE_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orders: existingOrders, isOpen })
        });
        console.log(`☁️ ¡PEDIDO SINCRONIZADO EN NUBE!: ${newOrder.id}`);
      } catch (e) {}
    }
  } catch (err) {
    console.error('❌ Error al procesar pedido de WhatsApp:', err);
  }
}

// Función para verificar si el local está ABIERTO según el reloj oficial o el control manual del Panel Admin
function getSpainTimeData() {
  try {
    const options = { timeZone: 'Europe/Madrid', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(new Date());
    let year, month, dayVal, hourVal = 0, minuteVal = 0;
    for (const part of parts) {
      if (part.type === 'year') year = parseInt(part.value, 10);
      if (part.type === 'month') month = parseInt(part.value, 10) - 1;
      if (part.type === 'day') dayVal = parseInt(part.value, 10);
      if (part.type === 'hour') hourVal = parseInt(part.value, 10);
      if (part.type === 'minute') minuteVal = parseInt(part.value, 10);
    }
    const spainDate = new Date(year, month, dayVal, hourVal, minuteVal);
    return {
      day: spainDate.getDay(),
      hour: hourVal === 24 ? 0 : hourVal
    };
  } catch(e) {
    const now = new Date();
    return { day: now.getDay(), hour: now.getHours() };
  }
}

function checkIsWithinBusinessHours() {
  try {
    const localPath = path.join(process.cwd(), 'public', 'cloud_orders.json');
    if (fs.existsSync(localPath)) {
      const raw = fs.readFileSync(localPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.isOpen !== undefined && parsed.isOpen !== null) {
        return parsed.isOpen;
      }
    }
  } catch (e) {}

  const { day, hour } = getSpainTimeData();

  if (day === 1) return false; // Lunes cerrado por descanso

  if ([2, 3, 4].includes(day)) {
    return hour >= 17 && hour < 24; // Mar-Jue 5 PM a 12 AM
  }

  if ([5, 6, 0].includes(day)) {
    return hour >= 17 || hour < 3; // Vie-Dom 5 PM a 3 AM
  }

  return true;
}

// Almacenamiento de sesiones activas de clientes
const userSessions = new Map();

function smartLocalAiEngine(text, userId, senderName = 'Cliente') {
  const t = text.trim().toLowerCase();
  let session = userSessions.get(userId) || { clientName: senderName, lastMenu: null, cart: [], total: 0, addressText: '', gpsLink: '', notes: '' };

  if (senderName && senderName !== 'Cliente' && (!session.clientName || session.clientName === 'Cliente')) {
    session.clientName = senderName;
  }

  const getHonorific = (name) => {
    if (!name || name === 'Cliente') return 'estimado cliente';
    const first = name.trim().split(' ')[0].toLowerCase();
    const femaleEnds = ['a', 'ia', 'na', 'is', 'ey'];
    if (femaleEnds.some(e => first.endsWith(e))) return `Sra. ${name}`;
    return `Sr. ${name}`;
  };

  const nameTag = getHonorific(session.clientName);

  // MANEJO INTELIGENTE POST-PEDIDO (GRACIAS / SE ME OLVIDÓ ALGO)
  if (session.lastMenu === 'completed') {
    if (t.includes('gracias') || t.includes('grac') || t.includes('excelente') || t.includes('perfecto') || t === 'ok' || t === 'vale') {
      return `¡Con el mayor de los gustos, ${nameTag}! 🇨🇴✨ Ha sido un verdadero placer atenderle hoy en **Que Chimba Parce**.

¡Su pedido ya está en preparación caliente en cocina! 🔥 Que disfrute de una deliciosa comida. ¡Quedamos a su entero servicio para cuando guste volver a pedir! 🍔🌭🍟`;
    }

    if (t.includes('olvid') || t.includes('falta') || t.includes('agregar') || t.includes('otra') || t.includes('mas') || t.includes('más')) {
      session.lastMenu = 'notes';
      userSessions.set(userId, session);
      return `¡Tranquilo, ${nameTag}! 📝😊 Con mucho gusto le agregamos lo que le haya faltado a su pedido.

Escriba qué plato o bebida desea añadir (ejemplo: *"Agrega 1x Postobón Manzana"* o *"Agrega 1x Perro Clásico"*) y de inmediato lo actualizamos en el Panel Admin antes de que salga el repartidor 🚀`;
    }
  }

  // REGLA CLAVE 1: Si el negocio está CERRADO, el Bot responde de manera muy formal y respetuosa
  const isOpenNow = checkIsWithinBusinessHours();
  if (!isOpenNow && !t.includes('horario') && !t.includes('precio')) {
    return `🌙 **¡Muy buenas tardes/noches, ${nameTag}!** 🇨🇴✨
Le saludamos muy cordialmente del restaurante **Que Chimba Parce**.

En este momento nuestro local se encuentra **CERRADO**.

⏰ **Horarios Oficiales de Atención:**
• **Martes a Jueves:** 17:00 hs a 00:00 hs (5 PM - 12 AM)
• **Viernes a Domingo:** 17:00 hs a 03:00 AM (5 PM - 3 AM)
• **Lunes:** Cerrado por descanso

🌐 **¡Puedes chismosear la carta completa, fotos y precios en nuestra web!**
👉 **https://parcequechimba.com**

Con el mayor de los gustos puede consultar los precios de nuestra carta escribiendo **Hamburguesas**, **Perros** o **Salchipapas**, pero **en este momento no estamos procesando pedidos activos**. ¡Le esperamos en nuestra próxima hora de apertura! 🔥🍔🌭`;
  }

  // Helper para generar el resumen explícito del pedido
  const buildExplicitSummary = () => {
    let summary = `🧾 **RESUMEN EXPLÍCITO DE SU PEDIDO (${nameTag.toUpperCase()}):**\n`;
    session.cart.forEach(item => {
      summary += `▪️ 1x ${item.name} (${item.price.toFixed(2)}€)\n`;
    });
    if (session.notes) {
      summary += `📝 **Notas especial / Cambio billete:** "${session.notes}"\n`;
    }
    summary += `\n💵 **Subtotal comida & bebida:** ${session.total.toFixed(2)}€\n`;
    summary += `🛵 **Servicio de Domicilio:** 2.00€\n`;
    summary += `💰 **TOTAL FINAL A PAGAR:** ${(session.total + 2.00).toFixed(2)}€\n\n`;
    summary += `📍 **ÚLTIMO PASO PARA ENVIAR A COCINA:**\n`;
    summary += `Toca en tu WhatsApp el clip 📎 (o ➕) ➔ **Ubicación** ➔ **"Enviar mi ubicación actual"** (o escríbeme el nombre de tu calle) para registrar tu dirección en el Panel Admin y despachar de inmediato 🚀`;
    return summary;
  };

  // 1. SOLICITUD EXPLÍCITA DE NOMBRE Y TELÉFONO DE CONTACTO
  if (session.lastMenu === 'ask_name') {
    session.clientName = text;
    session.lastMenu = 'ask_phone';
    userSessions.set(userId, session);

    return `¡Mucho gusto, ${getHonorific(text)}! 📱 **¿A qué número de teléfono llamamos al entregar?**
*(Escriba su número móvil de contacto o presione 0 para usar su número actual de WhatsApp)*:`;
  }

  if (session.lastMenu === 'ask_phone') {
    let rawPhone = userId.replace('@c.us', '').replace('@lid', '');
    if (rawPhone.length > 12) rawPhone = `+34 ${rawPhone.slice(-9)}`;
    else if (!rawPhone.startsWith('+')) rawPhone = `+34 ${rawPhone}`;

    session.contactPhone = (text === '0' || t.includes('mismo')) ? rawPhone : text;
    session.lastMenu = 'notes';
    userSessions.set(userId, session);

    return `¡Excelente, ${nameTag}! 📝 **¿Desea agregar alguna nota para la cocina o billete con el que paga (cambio)?**
*(Ejemplo: "Sin cebolla", "Salsas aparte", "Pago con billete de 50€ (traer cambio)", o escriba "Ninguna")*:`;
  }

  // 2. RECEPCIÓN DE NOTAS ESPECIALES O BILLETE DE CAMBIO
  if (session.lastMenu === 'notes') {
    if (t.includes('no') || t.includes('ningun') || t === '0' || t === 'sin notas') {
      session.notes = 'Sin cambios ni notas especiales';
    } else {
      session.notes = text;
    }
    session.lastMenu = 'confirming';
    userSessions.set(userId, session);

    return `¡Entendido, ${nameTag}! Registramos su nota: *"${session.notes}"*. 📝✨\n\n` + buildExplicitSummary();
  }

  // 3. SELECCIÓN DE BEBIDAS CON PASO A PEDIR NOMBRE
  if (session.lastMenu === 'drinks') {
    const drinkFlavors = [
      { name: 'Postobón Colombiana', price: 2.50 },
      { name: 'Postobón Manzana', price: 2.50 },
      { name: 'Postobón Uva', price: 2.50 },
      { name: 'Coca-Cola Helada 330ml', price: 1.80 },
      { name: 'Nestea Limón', price: 1.80 },
      { name: 'Jugo Natural Maracuyá en Agua', price: 3.00 },
      { name: 'Jugo Natural Lulo en Agua', price: 3.00 },
      { name: 'Jugo Natural Mango en Agua', price: 3.00 },
      { name: 'Jugo Natural Maracuyá en Leche', price: 3.50 },
      { name: 'Jugo Natural Lulo en Leche', price: 3.50 }
    ];

    let matchedDrink = null;
    if (t.includes('colombiana')) matchedDrink = drinkFlavors[0];
    else if (t.includes('manzana')) matchedDrink = drinkFlavors[1];
    else if (t.includes('uva')) matchedDrink = drinkFlavors[2];
    else if (t.includes('coca') || t.includes('cola')) matchedDrink = drinkFlavors[3];
    else if (t.includes('nestea') || t.includes('te')) matchedDrink = drinkFlavors[4];
    else if (t.includes('maracuya') && t.includes('leche')) matchedDrink = drinkFlavors[8];
    else if (t.includes('maracuya')) matchedDrink = drinkFlavors[5];
    else if (t.includes('lulo') && t.includes('leche')) matchedDrink = drinkFlavors[9];
    else if (t.includes('lulo')) matchedDrink = drinkFlavors[6];
    else if (t.includes('mango')) matchedDrink = drinkFlavors[7];
    else if (['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].includes(t)) {
      const idx = parseInt(t) - 1;
      matchedDrink = drinkFlavors[idx];
    }

    if (matchedDrink) {
      session.cart.push(matchedDrink);
      session.total += matchedDrink.price;
    }

    session.lastMenu = 'ask_name';
    userSessions.set(userId, session);

    return `¡Excelente elección! 👤 **¿A nombre de quién registramos este pedido?**
*(Escriba su nombre completo para recibirlo)*:`;
  }

  // 3. RECEPCIÓN DE DIRECCIÓN ESCRITA Y TIEMPO ESTIMADO
  if (session.lastMenu === 'confirming') {
    if (t.includes('cuanto') || t.includes('tarda') || t.includes('demora') || t.includes('tiempo') || t.includes('hola') || t.includes('duda')) {
      return `¡Con mucho gusto, ${nameTag}! 🕒 El tiempo estimado de entrega a domicilio a su puerta es de **25 a 35 minutos**.\n\n` + buildExplicitSummary();
    }

    if (!t.includes('hamburguesa') && !t.includes('perro') && !t.includes('salchipapa') && !t.includes('picada') && !t.includes('alita') && !t.includes('menu')) {
      session.addressText = text;
      session.lastMenu = 'completed';
      userSessions.set(userId, session);

      const orderId = 'WPP-' + Math.floor(1000 + Math.random() * 9000);
      const now = new Date();

      let clientPhone = userId.replace('@c.us', '').replace('@lid', '');
      if (clientPhone.length > 12 && !clientPhone.startsWith('+')) {
        clientPhone = `+34 ${clientPhone.slice(-9)}`;
      } else if (!clientPhone.startsWith('+')) {
        clientPhone = `+34 ${clientPhone}`;
      }

      const newOrder = {
        id: orderId,
        source: 'WhatsApp AI Bot 🤖',
        clientName: session.clientName || senderName || 'Cliente WhatsApp',
        phone: session.contactPhone || clientPhone,
        address: session.gpsLink ? `📍 ${session.gpsLink} | 🏠 ${text}` : `🏠 ${text}`,
        paymentMethod: t.includes('bizum') ? 'Bizum' : 'Efectivo',
        items: session.cart.length > 0 ? session.cart : [{ name: 'Pedido por WhatsApp AI', price: 10.00, quantity: 1 }],
        subtotal: session.total > 0 ? session.total : 10.00,
        deliveryFee: 2.00,
        total: (session.total > 0 ? session.total : 10.00) + 2.00,
        status: 'En Preparación',
        assignedDriver: null,
        notes: session.notes ? session.notes : `Pedido confirmado por WhatsApp`,
        timestamp: now.toISOString(),
        dateStr: now.toLocaleDateString('es-ES'),
        isoDateStr: now.toISOString().split('T')[0]
      };

      pushOrderToCloud(newOrder);

      return `¡Muchas gracias, ${nameTag}! 🧾✨ Hemos recibido y registrado sus datos de entrega:

👤 **Cliente:** ${newOrder.clientName}
📱 **Teléfono:** ${newOrder.phone}
🏠 **Dirección:** ${text}
${session.notes ? `📝 **Notas especial cocina / Cambio:** ${session.notes}\n` : ''}
✅ **SU PEDIDO ${orderId} HA SIDO DESPACHADO A LA COCINA EN EL PANEL ADMIN.**
💰 **TOTAL FINAL A PAGAR:** ${newOrder.total.toFixed(2)}€ (Efectivo / Bizum)
🕒 **Tiempo estimado de llegada:** 25 - 35 min 🛵

🛵 ¡Su pedido ya está en preparation caliente! Muchas gracias por comprar en Que Chimba Parce 🔥`;
    }
  }

  // 2. SELECCIÓN DE COMIDA CON DESPLIEGUE INMEDIATO DE SABORES DE BEBIDAS
  if (['1', '2', '3', '4', '5'].includes(t)) {
    const num = parseInt(t);
    let selectedFood = null;

    if (session.lastMenu === 'picadas') {
      const items = [
        { name: 'Picada Para 2', price: 15.00, desc: 'Papa francesa, papa criolla, arepa, longaniza, chicharrón al barril, carne y costilla al barril.' },
        { name: 'Picada Familiar', price: 25.00, desc: 'Papa francesa, papa criolla, arepa, longaniza, chicharrón al barril, carne y costilla al barril.' }
      ];
      selectedFood = items[num - 1];
    } else if (session.lastMenu === 'burgers') {
      const items = [
        { name: 'Hamburguesa Clásica', price: 6.00, desc: 'Carne, bacon, queso, cebolla caramelizada, tomate, lechuga, ensalada y salsa de la casa.' },
        { name: 'Hamburguesa Doble', price: 8.00, desc: 'Doble carne, bacon, queso, cebolla caramelizada, tomate, lechuga, ensalada y salsa de la casa.' },
        { name: 'Hamburguesa Paisa "Pan Brioche"', price: 10.00, desc: 'Doble carne, bacon, queso, plátano maduro, huevo, cebolla caramelizada, lechuga, ensalada y salsa de la casa.' },
        { name: 'Combo de Hamburguesa', price: 9.00, desc: 'Carne, bacon, queso, cebolla caramelizada, lechuga, tomate, ensalada (INCLUYE PATATAS Y BEBIDA).' }
      ];
      selectedFood = items[num - 1];
    } else if (session.lastMenu === 'perros') {
      const items = [
        { name: 'Perro Clásico', price: 4.00, desc: 'Salchicha, bacon, queso, ensalada, ripio y huevo de codorniz.' },
        { name: 'Perro Especial', price: 6.50, desc: 'Salchicha, bacon, queso, carne y pollo desmechado, cebolla caramelizada, ensalada, ripio, huevo de codorniz y salsa de la casa.' }
      ];
      selectedFood = items[num - 1];
    } else if (session.lastMenu === 'salchipapas') {
      const items = [
        { name: 'Clásicas', price: 4.50, desc: 'Patatas, salchicha, huevo de codorniz, queso y salsa de la casa.' },
        { name: 'Salchi Costi', price: 8.00, desc: 'Patatas, salchicha, huevo de codorniz, costilla (AL BARRIL), queso y salsa de la casa.' },
        { name: 'Salchi Paisa', price: 9.00, desc: 'Patatas, salchicha, queso, chicharron, costilla (AL BARRIL), huevo de codorniz y salsa de la casa.' },
        { name: 'La Picosa (Mexicana)', price: 9.00, desc: 'Patatas, salchicha, jalapeños, queso, carne desmechada, chorizo picante, huevo de codorniz, queso y salsa de la casa.' },
        { name: 'Salchi Mixta', price: 8.50, desc: 'Patatas, salchicha, pollo y carne desmechada, huevo de codorniz, queso y salsa de la casa.' }
      ];
      selectedFood = items[num - 1];
    } else if (session.lastMenu === 'alitas') {
      const items = [
        { name: '4 Alitas', price: 4.50, desc: 'Deliciosas alitas bañadas en salsa BBQ (INCLUYE PATATAS).' },
        { name: '8 Alitas', price: 8.00, desc: 'Deliciosas alitas bañadas en salsa BBQ (INCLUYE PATATAS).' },
        { name: '12 Alitas', price: 11.50, desc: 'Deliciosas alitas bañadas en salsa BBQ (INCLUYE PATATAS).' }
      ];
      selectedFood = items[num - 1];
    }

    if (selectedFood) {
      session.cart.push(selectedFood);
      session.total += selectedFood.price;
      session.lastMenu = 'drinks';
      userSessions.set(userId, session);

      return `¡Con mucho gusto, ${nameTag}! Agregamos **1x ${selectedFood.name} (${selectedFood.price.toFixed(2)}€)**. 🔥
📝 *${selectedFood.desc}*

🥤 **¿Desea agregar una Bebida con su SABOR FAVORITO?**

🇨🇴 **Gaseosas Colombianas (2.50€):**
1️⃣ **Postobón Colombiana**
2️⃣ **Postobón Manzana**
3️⃣ **Postobón Uva**

🥤 **Refrescos Helados (1.80€):**
4️⃣ **Coca-Cola 330ml**
5️⃣ **Nestea Limón**

🥭 **Jugos Naturales (3.00€ / 3.50€):**
6️⃣ **Maracuyá en Agua** (3.00€)
7️⃣ **Lulo en Agua** (3.00€)
8️⃣ **Mango en Agua** (3.00€)
9️⃣ **Maracuyá en Leche** (3.50€)
🔟 **Lulo en Leche** (3.50€)

❌ **0️⃣ No gracias, continuar a la entrega**

👉 Toca el botón o escribe el nombre del sabor (*ejemplo: Colombiana, Manzana, Coca-Cola*):`;
    }
  }

  // 4. MENÚ DE PICADAS PARA COMPARTIR
  if (t.includes('picada') || t.includes('barril') || t.includes('chicharron') || t.includes('costilla')) {
    session.lastMenu = 'picadas';
    userSessions.set(userId, session);
    return `¡Con mucho gusto, ${nameTag}! 🥩🔥 Seleccione su Picada respondiendo con el **número**:

1️⃣ **Picada Para 2** (15.00€)
   └ *Papa francesa, papa criolla, arepa, longaniza, chicharrón al barril, carne y costilla al barril.*

2️⃣ **Picada Familiar** (25.00€)
   └ *Bandeja gigante: papa francesa, papa criolla, arepa, longaniza, chicharrón al barril, carne y costilla.*

👉 Responda simplemente: **1** o **2**`;
  }

  // 5. HAMBURGUESAS
  if (t.includes('hamburguesa') || t.includes('burger')) {
    session.lastMenu = 'burgers';
    userSessions.set(userId, session);
    return `¡Con mucho gusto, ${nameTag}! 🍔 Seleccione su Hamburguesa respondiendo con el **número**:

1️⃣ **Hamburguesa Clásica** (6.00€)
   └ *Carne, bacon, queso, cebolla caramelizada, tomate, lechuga, ensalada y salsa de la casa.*

2️⃣ **Hamburguesa Doble** (8.00€)
   └ *Doble carne, bacon, queso, cebolla caramelizada, tomate, lechuga, ensalada y salsa de la casa.*

3️⃣ **Hamburguesa Paisa "Pan Brioche"** (10.00€)
   └ *Doble carne, bacon, queso, plátano maduro, huevo, cebolla caramelizada, lechuga, ensalada y salsa de la casa.*

4️⃣ **Combo de Hamburguesa** (9.00€)
   └ *Carne, bacon, queso, cebolla caramelizada, lechuga, tomate, ensalada (INCLUYE PATATAS Y BEBIDA).*

👉 Responda simplemente: **1**, **2**, **3** o **4**`;
  }

  // 6. PERROS COLOMBIANOS
  if (t.includes('perro') || t.includes('hotdog')) {
    session.lastMenu = 'perros';
    userSessions.set(userId, session);
    return `¡Con mucho gusto, ${nameTag}! 🌭 Seleccione su Perro Colombiano respondiendo con el **número**:

1️⃣ **Perro Clásico** (4.00€)
   └ *Salchicha, bacon, queso, ensalada, ripio y huevo de codorniz.*

2️⃣ **Perro Especial** (6.50€)
   └ *Salchicha, bacon, queso, carne y pollo desmechado, cebolla caramelizada, ensalada, ripio, huevo de codorniz y salsa.*

👉 Responda simplemente: **1** o **2**`;
  }

  // 7. SALCHIPAPAS
  if (t.includes('salchipapa') || t.includes('papa')) {
    session.lastMenu = 'salchipapas';
    userSessions.set(userId, session);
    return `¡Con mucho gusto, ${nameTag}! 🍟 Seleccione su Salchipapa XL respondiendo con el **número**:

1️⃣ **Clásicas** (4.50€)
   └ *Patatas, salchicha, huevo de codorniz, queso y salsa de la casa.*

2️⃣ **Salchi Costi** (8.00€)
   └ *Patatas, salchicha, huevo de codorniz, costilla (AL BARRIL), queso y salsa.*

3️⃣ **Salchi Paisa** (9.00€)
   └ *Patatas, salchicha, queso, chicharron, costilla (AL BARRIL), huevo de codorniz y salsa.*

4️⃣ **La Picosa (Mexicana)** (9.00€)
   └ *Patatas, salchicha, jalapeños, queso, carne desmechada, chorizo picante, huevo de codorniz y salsa.*

5️⃣ **Salchi Mixta** (8.50€)
   └ *Patatas, salchicha, pollo y carne desmechada, huevo de codorniz, queso y salsa.*

👉 Responda simplemente: **1**, **2**, **3**, **4** o **5**`;
  }

  // 8. ALITAS A LA BBQ
  if (t.includes('alita') || t.includes('bbq')) {
    session.lastMenu = 'alitas';
    userSessions.set(userId, session);
    return `¡Con mucho gusto, ${nameTag}! 🍗 Seleccione su porción de Alitas a la BBQ respondiendo con el **número**:

1️⃣ **4 Alitas** (4.50€)
   └ *Deliciosas alitas bañadas en salsa BBQ (INCLUYE PATATAS).*

2️⃣ **8 Alitas** (8.00€)
   └ *Deliciosas alitas bañadas en salsa BBQ (INCLUYE PATATAS).*

3️⃣ **12 Alitas** (11.50€)
   └ *Deliciosas alitas bañadas en salsa BBQ (INCLUYE PATATAS).*

👉 Responda simplemente: **1**, **2** o **3**`;
  }

  // 9. MENÚ GENERAL COMPLETO
  if (t.includes('menu') || t.includes('carta') || t.includes('hola') || t.includes('pedir')) {
    return `¡Muy buenas tardes, ${nameTag}! 🇨🇴✨ Bienvenido a **Que Chimba Parce**. Es un gusto atenderle.

Escriba la categoría que desea pedir hoy:
🥩 **Picadas** (Cortes al Barril)
🍔 **Hamburguesas**
🌭 **Perros**
🍟 **Salchipapas**
🍗 **Alitas a la BBQ**

🛵 Domicilio a tu puerta: 2.00€ extra.`;
  }

  return `¡Buenas tardes, ${nameTag}! 🇨🇴✨ Bienvenido a **Que Chimba Parce**.
Para atenderle con el mayor gusto, escriba **Hamburguesas**, **Perros**, **Salchipapas**, **Picadas** o **Alitas** y seleccione su plato respondiendo con un número (1, 2, 3...) 🍔🌭🍟🥩🍗`;
}

client.on('message', async (msg) => {
  try {
    if (msg.fromMe) return;
    if (msg.from.includes('status@broadcast')) return; // Ignorar historias
    if (msg.from.endsWith('@g.us')) return; // Ignorar chats grupales de WhatsApp

    // 1. RECEPCIÓN DE UBICACIÓN GPS DIRECTA POR WHATSAPP (1-CLIC DE ENVIAR UBICACIÓN)
    if (msg.type === 'location') {
      const lat = msg.location.latitude;
      const lng = msg.location.longitude;
      const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
      const clientName = msg._data?.notifyName || 'Cliente WhatsApp';

      let session = userSessions.get(msg.from) || { cart: [], total: 10.00 };
      const orderId = 'WPP-' + Math.floor(1000 + Math.random() * 9000);
      const now = new Date();

      const newOrder = {
        id: orderId,
        source: 'WhatsApp GPS Bot 📍',
        clientName: clientName,
        phone: msg.from.replace('@c.us', '').replace('@lid', ''),
        address: `📍 Ubicación GPS: ${mapsUrl}`,
        paymentMethod: 'Efectivo',
        items: session.cart.length > 0 ? session.cart : [{ name: 'Pedido por WhatsApp GPS', price: 10.00, quantity: 1 }],
        subtotal: session.total > 0 ? session.total : 10.00,
        deliveryFee: 2.00,
        total: (session.total > 0 ? session.total : 10.00) + 2.00,
        status: 'En Preparación',
        assignedDriver: null,
        notes: `Ubicación GPS recibida: ${mapsUrl}`,
        timestamp: now.toISOString(),
        dateStr: now.toLocaleDateString('es-ES'),
        isoDateStr: now.toISOString().split('T')[0]
      };

      await pushOrderToCloud(newOrder);

      await msg.reply(`¡Recibida tu Ubicación GPS al 100% parce! 📍
🔗 Google Maps: ${mapsUrl}

✅ **Tu pedido ${orderId} a nombre de ${clientName} ha sido despachado a la cocina en el Panel Admin.**
💰 **Total a Pagar (Comida + Domicilio 2.00€):** ${newOrder.total.toFixed(2)}€
🛵 ¡Tu pedido ya está en preparación! Muchas gracias por comprar en Que Chimba Parce 🔥`);
      return;
    }

    let userText = msg.body;
    console.log(`📩 Mensaje de WhatsApp recibido de ${msg.from}: ${userText || '[Audio / Ubicación]'}`);

    if (msg.hasMedia && (msg.type === 'audio' || msg.type === 'ptt')) {
      console.log('🎙️ Procesando audio de voz...');
      try {
        const media = await msg.downloadMedia();
        const tempPath = path.join(process.cwd(), 'temp_audio.ogg');
        fs.writeFileSync(tempPath, Buffer.from(media.data, 'base64'));

        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(tempPath),
          model: 'whisper-1',
          language: 'es'
        });

        userText = transcription.text;
        console.log(`🗣️ Transcripción de Voz: "${userText}"`);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (errAudio) {
        console.log('⚠️ Aviso: Usando respuesta inteligente para nota de voz...');
        userText = 'Quiero hacer un pedido de comida';
      }
    }

    if (!userText || !userText.trim()) return;

    let aiResponse = '';

    let senderNotifyName = msg._data?.notifyName || 'Cliente';

    // Capturar si el usuario envía una dirección por escrito después de la confirmación
    let session = userSessions.get(msg.from);
    if (session && session.lastMenu === 'confirming' && msg.type !== 'location') {
      session.addressText = userText;
      userSessions.set(msg.from, session);
    }

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userText }
        ],
        temperature: 0.7
      });
      aiResponse = completion.choices[0].message.content;
    } catch (errAi) {
      console.log('⚡ Usando Motor Local Formal (Gratis / 0 Créditos)...');
      aiResponse = smartLocalAiEngine(userText, msg.from, senderNotifyName);
    }

    console.log(`🤖 Respuesta enviada por WhatsApp: "${aiResponse}"`);
    await msg.reply(aiResponse);

    if (session && session.cart.length > 0 && (msg.type === 'location' || (session.lastMenu === 'confirming' && userText.length > 5))) {
      const now = new Date();
      const orderId = 'WPP-' + Math.floor(1000 + Math.random() * 9000);
      const clientName = session.clientName || senderNotifyName || 'Cliente WhatsApp';

      let formattedAddress = '';
      if (session.gpsLink && session.addressText) {
        formattedAddress = `📍 ${session.gpsLink} | 🏠 ${session.addressText}`;
      } else if (session.gpsLink) {
        formattedAddress = `📍 ${session.gpsLink}`;
      } else if (session.addressText) {
        formattedAddress = `🏠 ${session.addressText}`;
      } else {
        formattedAddress = `📍 GPS / WhatsApp: ${userText}`;
      }

      const newOrder = {
        id: orderId,
        source: 'WhatsApp AI Bot 🤖',
        clientName: clientName,
        phone: msg.from.replace('@c.us', '').replace('@lid', ''),
        address: formattedAddress,
        paymentMethod: userText.toLowerCase().includes('bizum') ? 'Bizum' : 'Efectivo',
        items: session.cart,
        subtotal: session.total,
        deliveryFee: 2.00,
        total: session.total + 2.00,
        status: 'En Preparación',
        assignedDriver: null,
        notes: `Pedido tomado formalmente por WhatsApp AI`,
        timestamp: now.toISOString(),
        dateStr: now.toLocaleDateString('es-ES'),
        isoDateStr: now.toISOString().split('T')[0]
      };

      await pushOrderToCloud(newOrder);
      console.log(`🚀 Pedido ${orderId} registrado al 100% en Nube y Panel Admin!`);
    }
  } catch (err) {
    console.error('❌ Error respondiendo mensaje en WhatsApp Bot:', err);
  }
});

client.initialize();
