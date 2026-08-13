import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const CLOUD_DB_URL = 'https://parcequechimba.com/api/orders';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

process.on('unhandledRejection', (reason, promise) => {
  console.log('⚠️ Aviso WhatsApp Bot Rejection:', reason);
});

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './whatsapp_session' }),
  authTimeoutMs: 120000,
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  }
});

console.log('🤖 Inicializando Bot de IA de WhatsApp para Que Chimba Parce...');

// Función para guardar pedidos recibidos por WhatsApp en la Nube unificada
async function pushOrderToCloud(newOrder) {
  try {
    const res = await fetch(`${CLOUD_DB_URL}?nocache=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json();
    let existingOrders = (data && Array.isArray(data.orders)) ? data.orders : [];
    
    // Evitar duplicados
    if (!existingOrders.some(o => o.id === newOrder.id)) {
      existingOrders.unshift(newOrder);
      await fetch(CLOUD_DB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: existingOrders,
          isOpen: data.isOpen !== undefined ? data.isOpen : true,
          lastUpdate: new Date().toISOString()
        })
      });
      console.log(`✅ ¡PEDIDO DE WHATSAPP UNIFICADO EN LA NUBE Y PANEL ADMIN!: ${newOrder.id}`);
    }
  } catch (err) {
    console.error('❌ Error al sincronizar pedido de WhatsApp en la Nube:', err);
  }
}

client.on('qr', async (qr) => {
  console.log('\n======================================================');
  console.log('📱 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP DEL RESTAURANTE:');
  console.log('======================================================\n');
  qrcodeTerminal.generate(qr, { small: true });

  try {
    const qrImagePath = path.join(process.cwd(), 'qr_whatsapp_bot.png');
    await QRCode.toFile(qrImagePath, qr, { width: 400 });
    console.log(`🖼️ Código QR guardado en imagen de alta calidad: ${qrImagePath}`);
  } catch (err) {
    console.error('Error al guardar QR en imagen:', err);
  }
});

client.on('ready', () => {
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
   - Bebidas (Postobón 2.50€, Coca-Cola 1.80€, Jugos Naturales 3.00€)
4. Pide los datos de entrega: Nombre completo, Dirección exacta y Método de pago (Efectivo o Bizum).
5. Cuando el cliente confirme la orden, genera un resumen formateado claro con el Total + los 2.00€ de domicilio.
`;

client.on('message', async (msg) => {
  try {
    if (msg.fromMe) return;

    let userText = msg.body;
    console.log(`📩 Mensaje recibido de ${msg.from}: ${userText || '[Nota de voz/Audio]'}`);

    if (msg.hasMedia && (msg.type === 'audio' || msg.type === 'ptt')) {
      console.log('🎙️ Transcribiendo audio con OpenAI Whisper...');
      const media = await msg.downloadMedia();
      const tempPath = path.join('./temp_audio.ogg');
      fs.writeFileSync(tempPath, Buffer.from(media.data, 'base64'));

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'whisper-1',
        language: 'es'
      });

      userText = transcription.text;
      console.log(`🗣️ Texto de la nota de voz: "${userText}"`);

      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }

    if (!userText) return;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userText }
      ],
      temperature: 0.7
    });

    const aiResponse = completion.choices[0].message.content;
    console.log(`🤖 Respuesta de IA enviada por WhatsApp: "${aiResponse}"`);

    await msg.reply(aiResponse);

    // Detectar si la respuesta contiene un resumen de pedido confirmado para registrarlo en el Panel Admin
    if (aiResponse.toLowerCase().includes('total') || aiResponse.toLowerCase().includes('resumen') || aiResponse.toLowerCase().includes('pedido')) {
      const now = new Date();
      const orderId = 'WPP-' + Math.floor(1000 + Math.random() * 9000);
      
      const newOrder = {
        id: orderId,
        source: 'WhatsApp AI Bot 🤖',
        clientName: msg._data?.notifyName || 'Cliente WhatsApp',
        phone: msg.from.replace('@c.us', ''),
        address: 'Pedido por WhatsApp AI Chat',
        paymentMethod: aiResponse.toLowerCase().includes('bizum') ? 'Bizum' : 'Efectivo',
        items: [{ name: 'Pedido por WhatsApp Chatbot', price: 10.00, quantity: 1 }],
        subtotal: 10.00,
        deliveryFee: 2.00,
        total: 12.00,
        status: 'En Preparación',
        assignedDriver: null,
        notes: userText,
        timestamp: now.toISOString(),
        dateStr: now.toLocaleDateString('es-ES'),
        isoDateStr: now.toISOString().slice(0, 10),
        timeStr: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      };

      pushOrderToCloud(newOrder);
    }

  } catch (error) {
    console.error('❌ Error en el Bot de WhatsApp:', error);
  }
});

client.initialize();
