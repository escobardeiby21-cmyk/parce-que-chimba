import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// Clave API de OpenAI del usuario
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './whatsapp_session' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

console.log('🤖 Inicializando Bot de IA para WhatsApp de Que Chimba Parce...');

client.on('qr', (qr) => {
  console.log('\n======================================================');
  console.log('📱 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP DEL RESTAURANTE:');
  console.log('======================================================\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('\n✅ ¡BOT DE IA DE QUE CHIMBA PARCE ENLAZADO Y LISTO EN WHATSAPP!');
  console.log('🚀 Escuchando mensajes de Texto y Audios de voz de clientes 24/7...\n');
});

// Prompt oficial del restaurante Que Chimba Parce
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
    // Ignorar mensajes enviados por el propio número del bot
    if (msg.fromMe) return;

    let userText = msg.body;
    console.log(`📩 Mensaje recibido de ${msg.from}: ${userText || '[Nota de voz/Audio]'}`);

    // Si el mensaje es una Nota de Voz (Audio)
    if (msg.hasMedia && (msg.type === 'audio' || msg.type === 'ptt')) {
      console.log('🎙️ Procesando nota de voz con OpenAI Whisper...');
      const media = await msg.downloadMedia();
      const tempPath = path.join('./temp_audio.ogg');
      fs.writeFileSync(tempPath, Buffer.from(media.data, 'base64'));

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'whisper-1',
        language: 'es'
      });

      userText = transcription.text;
      console.log(`🗣️ Transcripción de audio: "${userText}"`);

      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }

    if (!userText) return;

    // Procesar respuesta con OpenAI GPT-4o-mini
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userText }
      ],
      temperature: 0.7
    });

    const aiResponse = completion.choices[0].message.content;
    console.log(`🤖 Respuesta de IA: "${aiResponse}"`);

    // Enviar respuesta directa al cliente en WhatsApp
    await msg.reply(aiResponse);

  } catch (error) {
    console.error('❌ Error procesando mensaje de WhatsApp:', error);
  }
});

client.initialize();
