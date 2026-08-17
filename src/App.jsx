import { useState, useEffect } from 'react';
import { menuData } from './data';
import { motion, AnimatePresence } from 'framer-motion';

// Componente para las chispas flotantes de fondo
const BackgroundParticles = () => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    // Generar 20 partículas aleatorias
    const newParticles = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // % width
      y: Math.random() * 100, // % height
      size: Math.random() * 4 + 2, // 2px to 6px
      duration: Math.random() * 10 + 10, // 10s to 20s
      delay: Math.random() * 5,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-[var(--color-brand-orange)]/30 blur-[1px]"
          style={{ width: p.size, height: p.size, left: `${p.x}%`, top: `${p.y}%` }}
          animate={{
            y: [0, -100, -200],
            x: [0, Math.random() * 50 - 25, Math.random() * 50 - 25],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
};

// Safe JSON Parse Helper to prevent uncaught localStorage syntax errors
const safeJsonParse = (key, fallback = null) => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved || saved === 'undefined' || saved === 'null') return fallback;
    return JSON.parse(saved);
  } catch (e) {
    return fallback;
  }
};

// Helper para obtener la hora y día exacto de España (Europe/Madrid), sin importar la hora del PC del usuario
const getSpainTimeData = () => {
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
      hours: hourVal === 24 ? 0 : hourVal,
      minutes: minuteVal
    };
  } catch(e) {
    const now = new Date();
    return { day: now.getDay(), hours: now.getHours(), minutes: now.getMinutes() };
  }
};

// Helper para formatear direcciones y generar enlace de Google Maps GPS de forma limpia
const formatOrderAddressAndMaps = (address = '') => {
  if (!address) return { text: 'Dirección no especificada', mapsUrl: null };
  const strAddr = String(address);
  let mapsUrl = null;
  const match = strAddr.match(/https?:\/\/[^\s]+/);
  if (match) {
    mapsUrl = match[0];
  }

  let text = strAddr;
  if (mapsUrl) {
    // Si la dirección incluye una URL de Google Maps, limpiar el texto para no saturar la tarjeta
    text = strAddr.replace(mapsUrl, '').replace(/📍/g, '').replace(/Ubicación GPS:?/gi, '').trim();
    if (!text || text === ':') {
      text = 'Ubicación GPS enviada por el cliente';
    } else {
      text = `📍 ${text}`;
    }
  }

  return { text, mapsUrl };
};

function App() {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', notes: '', paymentMethod: 'Efectivo' });

  // PWA Prompt de instalación
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  // Estado de Geolocalización GPS
  const [isLocating, setIsLocating] = useState(false);

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isDriverOpen, setIsDriverOpen] = useState(false);
  const [activeView, setActiveView] = useState('menu'); // 'menu' | 'admin' | 'driver'
  const [adminPinInput, setAdminPinInput] = useState('');
  const [driverPinInput, setDriverPinInput] = useState('');
  
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    try {
      return localStorage.getItem('pq_chimba_admin_auth') === 'true';
    } catch(e) {
      return false;
    }
  });

  const [authenticatedDriver, setAuthenticatedDriver] = useState(() => {
    return safeJsonParse('pq_chimba_active_driver', null);
  });

  const [ordersHistory, setOrdersHistory] = useState(() => {
    return safeJsonParse('pq_chimba_orders', []);
  });
  const [adminTimeFilter, setAdminTimeFilter] = useState('all'); // 'all' (Todos los Pedidos en Vivo), 'shift', 'today', 'specific'
  const [liveOrdersFilter, setLiveOrdersFilter] = useState('pending'); // 'pending' (Solo Activos en Cocina) | 'all' (Todos)
  const [selectedCustomDate, setSelectedCustomDate] = useState(new Date().toISOString().slice(0,10));
  const [adminTab, setAdminTab] = useState('sales'); // 'sales' | 'crm' | 'inventory' | 'drivers' | 'reports'
  const [isChatbotEnabled, setIsChatbotEnabled] = useState(() => {
    return localStorage.getItem('pq_chimba_chatbot_enabled') === 'true';
  });

  const defaultInventory = [
    { id: 'inv1', name: 'Pan Brioche Hamburguesa', category: 'Panes', stock: 45, minStock: 15, unitCost: 0.60, unit: 'unidades' },
    { id: 'inv2', name: 'Carne Hamburguesa 150g', category: 'Carnes', stock: 50, minStock: 20, unitCost: 1.50, unit: 'unidades' },
    { id: 'inv3', name: 'Salchicha Perro Caliente', category: 'Carnes', stock: 30, minStock: 10, unitCost: 0.80, unit: 'unidades' },
    { id: 'inv4', name: 'Patatas Fritas Congeladas', category: 'Insumos', stock: 25, minStock: 8, unitCost: 2.20, unit: 'kg' },
    { id: 'inv5', name: 'Chicharrón al Barril', category: 'Carnes', stock: 12, minStock: 4, unitCost: 8.50, unit: 'kg' },
    { id: 'inv6', name: 'Costilla al Barril', category: 'Carnes', stock: 15, minStock: 5, unitCost: 9.00, unit: 'kg' },
    { id: 'inv7', name: 'Longaniza Paisa', category: 'Carnes', stock: 35, minStock: 12, unitCost: 1.10, unit: 'unidades' },
    { id: 'inv8', name: 'Postobón Manzana', category: 'Bebidas', stock: 48, minStock: 12, unitCost: 0.90, unit: 'latas' },
    { id: 'inv9', name: 'Postobón Colombiana', category: 'Bebidas', stock: 36, minStock: 10, unitCost: 0.90, unit: 'latas' },
    { id: 'inv10', name: 'Coca-Cola 330ml', category: 'Bebidas', stock: 60, minStock: 15, unitCost: 0.70, unit: 'latas' },
    { id: 'inv11', name: 'Pulpa Maracuyá', category: 'Bebidas', stock: 20, minStock: 6, unitCost: 1.20, unit: 'raciones' },
    { id: 'inv12', name: 'Pulpa Lulo', category: 'Bebidas', stock: 18, minStock: 6, unitCost: 1.20, unit: 'raciones' }
  ];

  const [inventory, setInventory] = useState(() => {
    return safeJsonParse('pq_chimba_inventory', defaultInventory);
  });

  const [newInvItem, setNewInvItem] = useState({ name: '', category: 'Carnes', stock: 10, minStock: 5, unitCost: 1.00, unit: 'unidades' });

  const saveInventory = (newList) => {
    setInventory(newList);
    localStorage.setItem('pq_chimba_inventory', JSON.stringify(newList));
  };

  const updateStock = (id, delta) => {
    const updated = inventory.map(item => {
      if (item.id === id) {
        const newStock = Math.max(0, item.stock + delta);
        return { ...item, stock: newStock };
      }
      return item;
    });
    saveInventory(updated);
  };

  // Modal de Detalle de Domicilios por Liquidar / Liquidados
  const [payoutDetailModal, setPayoutDetailModal] = useState(null); // { driverName, filterType: 'pending'|'settled' }
  const [newOrderToast, setNewOrderToast] = useState(null);
  const [printableTicket, setPrintableTicket] = useState(null);
  const [submittedOrderModal, setSubmittedOrderModal] = useState(null);

  // Reproductor de Timbre Real de Cocina 🔔 (Web Audio API - Cero dependencias externas)
  const playKitchenBellSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playTone = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.5, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      // Tono 1: Bell Chime (880Hz - A5)
      playTone(880, ctx.currentTime, 0.6);
      // Tono 2: Bell Chime High (1320Hz - E6)
      playTone(1320, ctx.currentTime + 0.15, 1.0);
    } catch(e) {}
  };

  // Función que calcula si el negocio está abierto según la Hora Oficial de España (Europe/Madrid)
  const checkIsWithinBusinessHours = () => {
    try {
      const { day, hours, minutes } = getSpainTimeData();
      const currentMins = hours * 60 + minutes;

      // Si estamos en la noche/tarde de 17:00 hs (5 PM) a 03:00 AM (ejemplo: 9:25 PM / 21:25 hs) -> SIEMPRE ABIERTO 🟢
      if (currentMins >= 17 * 60 || currentMins < 3 * 60) {
        return true;
      }

      // Lunes únicamente cerrado de 03:00 a 17:00 hs
      if (day === 1) return false;

      return true;
    } catch(e) {
      return true;
    }
  };

  // Anulación Manual del Dueño: null (Modo Automático), true (Manual Abierto), false (Manual Cerrado)
  const [manualOverride, setManualOverride] = useState(() => {
    return safeJsonParse('pq_chimba_manual_override', null);
  });

  // Estado de Abrir / Cerrar Negocio (Por defecto ABIERTO 🟢)
  const [isBusinessOpen, setIsBusinessOpen] = useState(() => {
    const overrideVal = safeJsonParse('pq_chimba_manual_override', null);
    if (overrideVal !== null) return overrideVal;
    const savedOpen = safeJsonParse('pq_chimba_is_open', null);
    if (savedOpen !== null) return savedOpen;
    return true;
  });

  const [showClosedModal, setShowClosedModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Estado para el Chatbot con Inteligencia Artificial (ParceBot AI)
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: '¡Hola parce! 👋 Soy ParceBot 🤖, tu asistente virtual de Que Chimba Parce 🇨🇴🇪🇸. Puedes hablarme por Voz 🎙️ o Escribirme 💬. ¿En qué te puedo ayudar hoy?',
      time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Función para dictado por voz (Micrófono)
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta dictado por voz. Puedes escribir tu mensaje en texto.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setChatInput(transcript);
        setIsListening(false);
        handleSendChatMessage(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  // Función para leer respuesta con voz humana
  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*_#•]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'es-ES';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Error al reproducir voz:', e);
    }
  };

  // Función de respuesta inteligente del Chatbot AI
  const handleSendChatMessage = (textToSend = null) => {
    const messageText = (textToSend || chatInput).trim();
    if (!messageText) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: messageText,
      time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    if (!textToSend) setChatInput('');
    setIsTyping(true);

    setTimeout(() => {
      let botResponse = '';
      const lower = messageText.toLowerCase();

      // REGLA CLAVE 1: Si el negocio está CERRADO (por horario automático o manual), la IA responde formalmente y NO toma pedidos activos
      if (!isBusinessOpen) {
        botResponse = `🌙 *¡Hola parce! En este momento nuestro local está CERRADO.* 

⏰ *Horarios Oficiales:*
• **Mar a Jue:** 17:00 hs - 00:00 hs
• **Vie a Dom:** 17:00 hs - 03:00 hs
• **Lunes:** Cerrado por descanso

Con gusto puedo mostrarte los precios y productos de nuestro menú para cuando abramos, pero **en este momento no estamos procesando pedidos activos**. ¡Te esperamos en nuestra próxima hora de apertura! 🔥🍔`;
      } else {
        // REGLA CLAVE 2: Si el negocio está ABIERTO, responde según la pregunta del usuario
        if (lower.includes('horario') || lower.includes('hora') || lower.includes('abiert')) {
          botResponse = `🟢 *¡Estamos ABIERTOS y recibiendo pedidos ahora mismo!* 🚀

⏰ *Horarios de Atención:*
• **Martes a Jueves:** 17:00 hs a 00:00 hs
• **Viernes a Domingo:** 17:00 hs a 03:00 hs (Madrugada)
• **Lunes:** Cerrado por descanso

¡Puedes agregar tus productos favoritos al carrito y enviarnos tu pedido directo por WhatsApp! 🍔🌭🍟`;
        } else if (lower.includes('perro') || lower.includes('hot dog') || lower.includes('colombiano')) {
          botResponse = `🌭 *¡Los verdaderos Perros Calientes Colombianos!*

• **Perro Colombiano Tradicional (6.50€):** Salchicha premium, queso derretido, jamón, ripio de papa, salsa rosada, salsa piña y huevo de codorniz.
• **Perro Salvaje XL (8.50€):** Tocineta crujiente, queso doble, maíz tierno y salsas especiales de la casa.

¿Te gustaría probar uno? 😉`;
        } else if (lower.includes('hamburguesa') || lower.includes('burger') || lower.includes('chimba')) {
          botResponse = `🍔 *¡Nuestras Hamburguesas Brutales!*

• **Burger Parce Especial (9.50€):** 180g de carne 100% vacuna, queso cheddar, tocineta ahumada, plátano maduro frito, lechuga, tomate y salsa de la casa.
• **Burger Doble Brutal (12.00€):** Doble carne (360g), doble queso, tocineta extra y huevo frito.

¡Puedes pedirla directamente desde la sección Hamburguesas del menú! 🔥`;
        } else if (lower.includes('salchipapa') || lower.includes('papa')) {
          botResponse = `🍟 *¡Salchipapas Colombianas bien cargadas!*

• **Salchipapa Tradicional (7.00€):** Papa amarilla crujiente, salchicha picada, queso costeño rallado, salsa rosada y piña.
• **Salchipapa La Chimba XL (11.50€):** Papa, salchicha, carne desmechada, pollo, tocineta, maíz tierno, huevo de codorniz y queso fundido.`;
        } else if (lower.includes('domicilio') || lower.includes('envio') || lower.includes('entrega') || lower.includes('costo') || lower.includes('reparto')) {
          botResponse = `🛵 *Servicio de Domicilio:*
• El costo de envío en nuestra zona de cobertura es de solo **2.00€**.
• Entregamos tu pedido caliente, recién preparado y directo a tu puerta. 📦⚡`;
        } else if (lower.includes('pedido') || lower.includes('comprar') || lower.includes('orden') || lower.includes('whatsapp')) {
          botResponse = `📲 *¿Listo para realizar tu pedido?*

Puedes seleccionar tus productos arriba en el menú interactivo, hacer clic en el carrito flotante y presionar **"Enviar Pedido por WhatsApp"**.

🛵 *Recuerda:* El costo de envío a domicilio es de solo **2.00€** extra. ¡Nos llegará directo a la cocina! 🍳🔥`;
        } else {
          botResponse = `¡Con gusto parce! 😊 En Que Chimba Parce tenemos las mejores Hamburguesas 🍔, Perros Colombianos 🌭, Salchipapas XL 🍟, Cholados 🍧 y Empanadas 🥟.

🛵 *Recordatorio:* El costo de domicilio es de solo **2.00€**. ¿Quieres consultar algún precio, los horarios o realizar tu pedido por WhatsApp?`;
        }
      }

      setChatMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: botResponse,
          time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setIsTyping(false);
      speakText(botResponse);
    }, 600);
  };

  // Efecto que re-calcula el estado del negocio cada 30 segundos según el horario oficial
  useEffect(() => {
    const updateAutoStatus = () => {
      const savedManual = localStorage.getItem('pq_chimba_manual_override');
      const overrideVal = savedManual !== null ? JSON.parse(savedManual) : null;
      if (overrideVal === null) {
        const autoStatus = checkIsWithinBusinessHours();
        setIsBusinessOpen(autoStatus);
      }
    };

    updateAutoStatus();
    const interval = setInterval(updateAutoStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const setBusinessMode = (mode) => {
    // mode: 'auto' | 'open' | 'close'
    let nextOverride = null;
    let nextOpenStatus = false;

    if (mode === 'auto') {
      nextOverride = null;
      nextOpenStatus = checkIsWithinBusinessHours();
      localStorage.removeItem('pq_chimba_manual_override');
    } else if (mode === 'open') {
      nextOverride = true;
      nextOpenStatus = true;
      localStorage.setItem('pq_chimba_manual_override', JSON.stringify(true));
    } else if (mode === 'close') {
      nextOverride = false;
      nextOpenStatus = false;
      localStorage.setItem('pq_chimba_manual_override', JSON.stringify(false));
    }

    setManualOverride(nextOverride);
    setIsBusinessOpen(nextOpenStatus);
    localStorage.setItem('pq_chimba_is_open', JSON.stringify(nextOpenStatus));
    saveOrdersToCloudAndLocal(ordersHistory, nextOpenStatus);
  };

  // Enviar Confirmación de Pedido por WhatsApp al Cliente (1-Clic directamente al número del cliente)
  const sendCustomerConfirmationWhatsApp = (order) => {
    let clientPhone = order.phone || '';
    let cleanPhone = clientPhone.replace(/[^0-9]/g, '');
    
    // Si el teléfono no está disponible o es inválido, solictarlo al dueño
    if (!cleanPhone || cleanPhone.length < 9) {
      const inputPhone = prompt(`Ingresa el número de WhatsApp del cliente (${order.clientName}):`, clientPhone);
      if (!inputPhone) return;
      cleanPhone = inputPhone.replace(/[^0-9]/g, '');
    }

    if (cleanPhone.length === 9) {
      cleanPhone = `34${cleanPhone}`;
    }

    const flagCO = "🇨🇴";
    const flagES = "🇪🇸";

    let msg = `¡Hola *${order.clientName}*! 🍔🔥\n\n`;
    msg += `Hemos recibido y confirmado tu pedido *${order.id}* en *Que Chimba Parce*.\n\n`;
    msg += `🧾 *DESGLOSE DE TU PEDIDO:*\n`;
    if (Array.isArray(order.items)) {
      order.items.forEach(i => {
        msg += `▪️ ${i.quantity}x ${i.name} (${(i.price * i.quantity).toFixed(2)}€)\n`;
      });
    }
    msg += `\n💵 *Subtotal:* ${(order.subtotal || order.total - 2.0).toFixed(2)}€\n`;
    msg += `🛵 *Domicilio:* ${(order.deliveryFee || 2.0).toFixed(2)}€\n`;
    msg += `💰 *TOTAL A PAGAR:* ${order.total.toFixed(2)}€ (${order.paymentMethod})\n\n`;
    msg += `📍 *Dirección de Entrega:* ${order.address}\n`;
    if (order.assignedDriver) msg += `🛵 *Repartidor Asignado:* ${order.assignedDriver}\n`;
    msg += `\n¡Tu pedido ya está *EN PREPARACIÓN* en cocina con todo el sabor! ${flagCO} ${flagES}✨\n¡Muchas gracias por preferirnos!`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Enviar Notificación de Pedido Entregado por WhatsApp al Cliente (1-Clic directamente al cliente)
  const sendCustomerDeliveredWhatsApp = (order) => {
    let clientPhone = order.phone || '';
    let cleanPhone = clientPhone.replace(/[^0-9]/g, '');
    
    if (!cleanPhone || cleanPhone.length < 9) {
      const inputPhone = prompt(`Ingresa el número de WhatsApp del cliente (${order.clientName}):`, clientPhone);
      if (!inputPhone) return;
      cleanPhone = inputPhone.replace(/[^0-9]/g, '');
    }

    if (cleanPhone.length === 9) {
      cleanPhone = `34${cleanPhone}`;
    }

    const flagCO = "🇨🇴";
    const flagES = "🇪🇸";

    let msg = `¡Pedido *${order.id}* Entregado! ✅\n\n`;
    msg += `¡Muchas gracias por tu compra en *Que Chimba Parce*, ${order.clientName}! 🍔❤️\n`;
    msg += `¡Esperamos que disfrutes al máximo tu comida!\n\n`;
    msg += `Si te gustó, ¡recuerda recomendarnos a tus amigos! ${flagCO} ${flagES}✨`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Repartidores Dinámicos
  const defaultDrivers = [
    { id: 'DRV-1', name: 'Luis', phone: '644111222', pin: '1111' },
    { id: 'DRV-2', name: 'Carlos', phone: '644333444', pin: '2222' }
  ];

  const [driversList, setDriversList] = useState(() => {
    return safeJsonParse('pq_chimba_drivers', defaultDrivers);
  });

  const [newDriverData, setNewDriverData] = useState({ name: '', phone: '', pin: '' });

  const deliveryFee = 2.00;
  const ADMIN_PIN = "2528";

  // Estado para Modal Personalizado Profesional de Confirmación (en el centro)
  const [confirmModalData, setConfirmModalData] = useState(null);

  const confirmDeleteOrderModal = (orderId) => {
    setConfirmModalData({
      title: `⚠️ ¿Eliminar Pedido ${orderId}?`,
      message: `¿Estás seguro de cancelar y eliminar el pedido ${orderId}? Se borrará de forma permanente de la Nube y del Panel Admin.`,
      confirmText: '🔴 Sí, Eliminar',
      confirmColor: 'bg-red-600 hover:bg-red-500',
      onConfirm: async () => {
        const deletedIds = new Set(JSON.parse(localStorage.getItem('pq_chimba_deleted_ids') || '[]'));
        deletedIds.add(orderId);
        localStorage.setItem('pq_chimba_deleted_ids', JSON.stringify(Array.from(deletedIds)));

        const updatedHistory = ordersHistory.filter(o => o.id !== orderId);
        setOrdersHistory(updatedHistory);
        localStorage.setItem('pq_chimba_orders', JSON.stringify(updatedHistory));
        await saveOrdersToCloudAndLocal(updatedHistory, isBusinessOpen, true);
        setConfirmModalData(null);
      }
    });
  };

  const confirmClearAllModal = () => {
    setConfirmModalData({
      title: '🗑️ ¿Vaciar Historial de Pruebas?',
      message: '¿Estás seguro de borrar TODO el historial de pedidos de prueba? Esta acción dejará la lista en (0) pedidos.',
      confirmText: '🔴 Sí, Vaciar Todo',
      confirmColor: 'bg-red-600 hover:bg-red-500',
      onConfirm: async () => {
        setOrdersHistory([]);
        localStorage.setItem('pq_chimba_orders', JSON.stringify([]));
        localStorage.setItem('pq_chimba_deleted_ids', JSON.stringify([]));
        await saveOrdersToCloudAndLocal([], isBusinessOpen, true);
        setConfirmModalData(null);
      }
    });
  };

  // Login/Logout con Persistencia
  const loginAdmin = () => {
    setIsAdminAuthenticated(true);
    localStorage.setItem('pq_chimba_admin_auth', 'true');
    setAdminPinInput('');
  };

  const logoutAdmin = () => {
    setIsAdminAuthenticated(false);
    localStorage.removeItem('pq_chimba_admin_auth');
  };

  const loginDriver = (driverObj) => {
    setAuthenticatedDriver(driverObj);
    localStorage.setItem('pq_chimba_active_driver', JSON.stringify(driverObj));
    setDriverPinInput('');
  };

  const logoutDriver = () => {
    setAuthenticatedDriver(null);
    localStorage.removeItem('pq_chimba_active_driver');
  };

  // Función para obtener la ubicación GPS actual del cliente (Dirección escrita + Link de Google Maps)
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Tu navegador o teléfono no soporta geolocalización GPS');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;

        // Intentar obtener la dirección escrita por geocodificación inversa (OpenStreetMap Nominatim API)
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          .then(res => res.json())
          .then(data => {
            const streetParts = data && data.display_name ? data.display_name.split(',') : [];
            const shortStreet = streetParts.slice(0, 3).join(',').trim();
            const locationText = shortStreet 
              ? `${shortStreet} (📍 GPS: ${mapsUrl})` 
              : `📍 Ubicación GPS: ${mapsUrl}`;

            setFormData(prev => ({
              ...prev,
              address: prev.address ? `${prev.address} | ${locationText}` : locationText
            }));
            setIsLocating(false);
          })
          .catch(() => {
            const fallbackText = `📍 Ubicación GPS: ${mapsUrl}`;
            setFormData(prev => ({
              ...prev,
              address: prev.address ? `${prev.address} | ${fallbackText}` : fallbackText
            }));
            setIsLocating(false);
          });
      },
      (error) => {
        setIsLocating(false);
        alert('No se pudo obtener la ubicación por GPS. Por favor escribe tu dirección manualmente.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Escuchar el evento de instalación PWA (Android / Chrome)
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = () => {
    // Descarga directa del archivo APK oficial de la aplicación Android
    try {
      const link = document.createElement('a');
      link.href = '/que-chimba-parce.apk';
      link.download = 'Que-Chimba-Parce.apk';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch(e) {}

    // Si la App cuenta además con la función PWA nativa de Android/Chrome
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            setDeferredPrompt(null);
          }
        });
      } catch(e) {}
    } else {
      setShowInstallGuide(true);
    }
  };

  // Guardar y sincronizar la lista de pedidos y estado del negocio con la nube en tiempo real
  const saveOrdersToCloudAndLocal = async (newOrdersList, currentOpenStatus = isBusinessOpen, forceOverride = false) => {
    let finalOrdersList = newOrdersList;

    setOrdersHistory(finalOrdersList);
    localStorage.setItem('pq_chimba_orders', JSON.stringify(finalOrdersList));

    const payloadStr = JSON.stringify({ orders: finalOrdersList, isOpen: currentOpenStatus, isChatbotEnabled });

    // 1. Guardar en Vercel Backend /api/orders (Aislado de excepciones de Chrome)
    try {
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadStr
      }).catch(() => {});
    } catch (err) {}

    // 2. Guardar en Nube Persistente Global (Aislado para Chrome/Android)
    try {
      fetch('https://api.restful-api.dev/objects/ff8081819ff5b11001a00bc5b83a2ee8', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: "ParceQueChimbaOrders", data: { orders: finalOrdersList, isOpen: currentOpenStatus } })
      }).catch(() => {});
    } catch (err) {}

    // 3. Guardar en Servidor Local (Aislado)
    try {
      fetch('http://localhost:3333/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadStr
      }).catch(() => {});
    } catch (err) {}
  };

  // Escuchar y sincronizar automáticamente pedidos desde la nube en tiempo real desde /api/orders
  const fetchCloudOrders = async () => {
    try {
      const ts = Date.now();
      let res;
      // PRIORIDAD MÁXIMA: Consultar el endpoint dinámico en vivo /api/orders
      try {
        res = await fetch(`/api/orders?nocache=${ts}`);
        if (!res || !res.ok) {
          res = await fetch(`/cloud_orders.json?nocache=${ts}`);
        }
      } catch (e) {
        try {
          res = await fetch(`/cloud_orders.json?nocache=${ts}`);
        } catch (e2) {}
      }

      // También intentar sincronizar desde la Nube Persistente Global
      let directCloudOrders = [];
      try {
        const directCloudRes = await fetch(`https://api.restful-api.dev/objects/ff8081819ff5b11001a00bc5b83a2ee8?nocache=${ts}`);
        if (directCloudRes && directCloudRes.ok) {
          const directData = await directCloudRes.json();
          if (Array.isArray(directData?.data?.orders)) directCloudOrders = directData.data.orders;
        }
      } catch(e) {}

      // También intentar sincronizar desde el servidor local si está corriendo en la misma red
      let localDaemonOrders = [];
      try {
        const localDaemonRes = await fetch(`http://localhost:3333/api/orders?nocache=${ts}`);
        if (localDaemonRes && localDaemonRes.ok) {
          const daemonData = await localDaemonRes.json();
          if (Array.isArray(daemonData?.orders)) localDaemonOrders = daemonData.orders;
        }
      } catch(e) {}

      if (res && res.ok) {
        const data = await res.json();

        if (data && typeof data === 'object') {
          // COMBINAR pedidos locales, nube /api/orders, Nube Persistente y servidor WhatsApp por ID
          const cloudList = Array.isArray(data.orders) ? data.orders : [];
          const allIncoming = [...cloudList, ...directCloudOrders, ...localDaemonOrders];
          const deletedIds = new Set(safeJsonParse('pq_chimba_deleted_ids', []));
          const validCloudOrders = allIncoming.filter(o => o && o.id && !deletedIds.has(o.id));
          const localOrders = safeJsonParse('pq_chimba_orders', []).filter(o => o && o.id && !deletedIds.has(o.id));
          const mergedMap = new Map();

          // Insertar pedidos remotos primero (excluyendo eliminados)
          validCloudOrders.forEach(o => { if (o && o.id) mergedMap.set(o.id, o); });
          // Preservar pedidos locales que no estén en remoto
          localOrders.forEach(o => { if (o && o.id && !mergedMap.has(o.id)) mergedMap.set(o.id, o); });

          const mergedList = Array.from(mergedMap.values());
          setOrdersHistory(mergedList);
          localStorage.setItem('pq_chimba_orders', JSON.stringify(mergedList));

          if (typeof data.isOpen === 'boolean') {
            const savedManual = localStorage.getItem('pq_chimba_manual_override');
            if (savedManual === null) {
              setIsBusinessOpen(data.isOpen);
              localStorage.setItem('pq_chimba_is_open', JSON.stringify(data.isOpen));
            }
          }
        }
      }
    } catch (err) {}
  };

  // Helper para cerrar el Panel Admin y limpiar la URL completamente
  const closeAdminPanel = () => {
    setIsAdminOpen(false);
    setActiveView('menu');
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('admin');
      window.history.replaceState({}, document.title, url.pathname);
    } catch(e) {}
  };

  useEffect(() => {
    // Forzar actualización inmediata del Service Worker PWA para invalidar cachés viejos en cualquier dispositivo
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          registration.update();
        }
      }).catch(() => {});
    }

    // GARANTIZADO: La web SIEMPRE abre en la vista de Menú para el cliente
    setIsAdminOpen(false);
    setActiveView('menu');

    // Limpiar cualquier parámetro de admin en la URL al cargar
    if (window.location.search.includes('admin') || window.location.hash.includes('admin')) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('admin');
        window.history.replaceState({}, document.title, url.pathname);
      } catch(e) {}
    }

    fetchCloudOrders();
    const interval = setInterval(fetchCloudOrders, 2000);

    // Conectar Suscriptores SSE en Tiempo Real (<0.1s de latencia)
    const connectSSE = (url) => {
      try {
        const es = new EventSource(url);
        es.addEventListener('new_order', (e) => {
          try {
            const incoming = JSON.parse(e.data);
            if (incoming && incoming.id) {
              setOrdersHistory(prev => {
                if (!prev.some(o => o.id === incoming.id)) {
                  playKitchenBellSound();
                  setNewOrderToast(incoming);
                  setTimeout(() => setNewOrderToast(null), 6000);
                  return [incoming, ...prev];
                }
                return prev;
              });
            }
          } catch(err) {}
        });
        return es;
      } catch(err) { return null; }
    };

    const esLocal = connectSSE('http://localhost:3333/api/events');
    const esRemote = connectSSE('/api/events');

    return () => {
      clearInterval(interval);
      try { if (esLocal) esLocal.close(); } catch(e){}
      try { if (esRemote) esRemote.close(); } catch(e){}
    };
  }, []);

  // Guardar lista de repartidores en localStorage
  const saveDriversList = (newList) => {
    setDriversList(newList);
    localStorage.setItem('pq_chimba_drivers', JSON.stringify(newList));
  };

  const addDriver = (e) => {
    e.preventDefault();
    if (!newDriverData.name || !newDriverData.pin) return alert('Por favor ingresa nombre y PIN');
    if (driversList.some(d => d.pin === newDriverData.pin)) return alert('Este PIN ya está en uso por otro repartidor');
    
    const driver = {
      id: 'DRV-' + Date.now(),
      name: newDriverData.name,
      phone: newDriverData.phone || 'N/A',
      pin: newDriverData.pin
    };
    saveDriversList([...driversList, driver]);
    setNewDriverData({ name: '', phone: '', pin: '' });
    alert(`Repartidor ${driver.name} agregado con éxito (PIN: ${driver.pin})`);
  };

  const removeDriver = (id) => {
    if (confirm('¿Deseas eliminar a este repartidor? Su historial de entregas pasadas se mantendrá en la contabilidad.')) {
      saveDriversList(driversList.filter(d => d.id !== id));
    }
  };

  // Estado para modal de selección de sabores (Jugos Naturales / Gaseosa 2L)
  const [flavorModalItem, setFlavorModalItem] = useState(null);

  const addToCart = (item, chosenFlavor = null) => {
    if (!isBusinessOpen) {
      setShowClosedModal(true);
      return;
    }

    // Si es un Jugo Natural o Gaseosa 2L y no se ha escogido el sabor, abrir modal de selección
    if (!chosenFlavor) {
      if (item.id === 'b7' || item.id === 'b8') {
        setFlavorModalItem({ item, title: 'Selecciona el Sabor de tu Jugo Natural:', options: ['Maracuyá', 'Fresa', 'Mora', 'Lulo', 'Mango', 'Guayaba'] });
        return;
      }
      if (item.id === 'b6') {
        setFlavorModalItem({ item, title: 'Selecciona el Sabor de tu Gaseosa 2 Litros:', options: ['Manzana Postobón', 'Uva Postobón', 'Colombiana', 'Coca-Cola'] });
        return;
      }
    }

    const finalItem = chosenFlavor 
      ? { ...item, id: `${item.id}_${chosenFlavor}`, name: `${item.name} (${chosenFlavor})` }
      : item;

    setCart(prev => {
      const existing = prev.find(i => i.id === finalItem.id);
      if (existing) {
        return prev.map(i => i.id === finalItem.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...finalItem, quantity: 1 }];
    });

    setFlavorModalItem(null);
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQ = i.quantity + delta;
        return newQ > 0 ? { ...i, quantity: newQ } : i;
      }
      return i;
    }));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartTotal = cart.length > 0 ? cartSubtotal + deliveryFee : 0;

  // Procesar nuevo pedido desde la web (Garantizando el envío a la Nube ANTES de abrir WhatsApp)
  const handleOrder = async (e) => {
    e.preventDefault();
    if (!isBusinessOpen) {
      setShowClosedModal(true);
      return;
    }
    if (cart.length === 0) return alert('El carrito está vacío');
    
    const now = new Date();
    const isoDateStr = now.toISOString().slice(0,10);

    const uniqueCode = Math.floor(100 + Math.random() * 900);
    const orderId = `#PQ-${uniqueCode}`;

    const newOrder = {
      id: orderId,
      timestamp: now.toISOString(),
      isoDateStr: isoDateStr,
      dateStr: now.toLocaleDateString('es-ES'),
      timeStr: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      status: 'En Preparación',
      assignedDriver: '',
      deliveredTimeStr: '',
      isSettled: false,
      settledDate: '',
      clientName: formData.name,
      phone: formData.phone,
      address: formData.address,
      notes: formData.notes,
      paymentMethod: formData.paymentMethod,
      items: [...cart],
      subtotal: cartSubtotal,
      deliveryFee: deliveryFee,
      total: cartTotal
    };

    const updatedHistory = [newOrder, ...ordersHistory];
    
    // Guardar el pedido en la Nube y LocalStorage en tiempo real de forma inmediata
    saveOrdersToCloudAndLocal(updatedHistory, isBusinessOpen, true);

    // Limpiar carrito y mostrar primero la ventana flotante de confirmación en la web
    setCart([]);
    setIsCartOpen(false);
    setSubmittedOrderModal(newOrder);
  };

  // Cambiar estado de un pedido (Despachar / Asignar / Entregar)
  const updateOrderStatus = (orderId, newStatus, driverName = '') => {
    const updatedHistory = ordersHistory.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status: newStatus,
          assignedDriver: driverName || o.assignedDriver,
          deliveredTimeStr: newStatus === 'Entregado' ? new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : o.deliveredTimeStr
        };
      }
      return o;
    });
    saveOrdersToCloudAndLocal(updatedHistory, isBusinessOpen, true);
  };

  // Eliminar o Cancelar un Pedido Específico
  const deleteOrder = async (orderId) => {
    if (confirm(`¿Estás seguro de cancelar y eliminar el pedido ${orderId}? Se borrará inmediatamente de la Nube.`)) {
      const deletedIds = new Set(JSON.parse(localStorage.getItem('pq_chimba_deleted_ids') || '[]'));
      deletedIds.add(orderId);
      localStorage.setItem('pq_chimba_deleted_ids', JSON.stringify(Array.from(deletedIds)));

      const updatedHistory = ordersHistory.filter(o => o.id !== orderId);
      setOrdersHistory(updatedHistory);
      localStorage.setItem('pq_chimba_orders', JSON.stringify(updatedHistory));
      await saveOrdersToCloudAndLocal(updatedHistory, isBusinessOpen, true);
      alert(`✅ Pedido ${orderId} eliminado con éxito de la Nube.`);
    }
  };

  // Liquidar ganancias acumuladas a un repartidor
  const settleDriverPayout = (driverName) => {
    const pendingOrders = ordersHistory.filter(o => o.assignedDriver === driverName && o.status === 'Entregado' && !o.isSettled);
    if (pendingOrders.length === 0) return alert(`No hay entregas pendientes por liquidar para ${driverName}`);
    
    const amountToSettle = pendingOrders.length * deliveryFee;
    if (confirm(`¿Confirmas liquidar y pagar ${amountToSettle.toFixed(2)}€ a ${driverName} por ${pendingOrders.length} envíos realizados?`)) {
      const nowStr = new Date().toLocaleDateString('es-ES') + ' ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const updatedHistory = ordersHistory.map(o => {
        if (o.assignedDriver === driverName && o.status === 'Entregado' && !o.isSettled) {
          return { ...o, isSettled: true, settledDate: nowStr };
        }
        return o;
      });
      saveOrdersToCloudAndLocal(updatedHistory);
      alert(`✅ Liquidación completada. Se marcaron ${pendingOrders.length} domicilios como LIQUIDADOS.`);
    }
  };

  // Helper: Calcular estadísticas filtradas del Admin Panel
  const calculateAdminFilteredStats = () => {
    const todayStr = new Date().toLocaleDateString('es-ES');
    let filtered = ordersHistory || [];

    if (adminTimeFilter === 'shift') {
      const now = new Date();
      let shiftStart = new Date(now);
      if (now.getHours() < 6) {
        shiftStart.setDate(shiftStart.getDate() - 1);
      }
      shiftStart.setHours(6, 0, 0, 0);

      const shiftEnd = new Date(shiftStart);
      shiftEnd.setDate(shiftEnd.getDate() + 1);

      filtered = ordersHistory.filter(o => {
        const oDate = new Date(o.createdAt || o.id);
        return oDate >= shiftStart && oDate < shiftEnd;
      });
    } else if (adminTimeFilter === 'today') {
      filtered = ordersHistory.filter(o => o.dateStr === todayStr);
    } else if (adminTimeFilter === 'specific') {
      filtered = ordersHistory.filter(o => o.isoDateStr === selectedCustomDate);
    }

    const totalSales = filtered.reduce((acc, o) => acc + (o.total || 0), 0);
    const totalOrdersCount = filtered.length;
    const totalDeliveryFees = filtered.reduce((acc, o) => acc + (o.deliveryFee || 2.0), 0);
    const isShiftFilter = adminTimeFilter === 'shift';

    return { totalSales, totalOrdersCount, totalDeliveryFees, isShiftFilter };
  };

  // Helper: Obtener estadísticas de liquidación por repartidor
  const getDriverSettlementStats = (driverName) => {
    const driverOrders = (ordersHistory || []).filter(o => o.assignedDriver === driverName);
    const pendingOrders = driverOrders.filter(o => !o.isSettled && o.status === 'Entregado');
    const settledOrders = driverOrders.filter(o => o.isSettled);

    const pendingDeliveryFees = pendingOrders.length * deliveryFee;
    const settledDeliveryFees = settledOrders.length * deliveryFee;

    return {
      pendingCount: pendingOrders.length,
      pendingDeliveryFees,
      settledCount: settledOrders.length,
      settledDeliveryFees
    };
  };

  // Helper: Asignar repartidor a pedido
  const assignDriverToOrder = (orderId, driverName) => {
    const updated = ordersHistory.map(o => {
      if (o.id === orderId) {
        return { ...o, assignedDriver: driverName };
      }
      return o;
    });
    setOrdersHistory(updated);
    saveOrdersToCloudAndLocal(updated);
  };

  // Helper: Imprimir Ticket POS
  const printTicket = (order) => {
    setPrintableTicket(order);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Helper: Registrar nuevo repartidor
  const addNewDriver = () => {
    const name = prompt('Nombre del nuevo repartidor:');
    if (!name) return;
    const pin = prompt(`PIN de acceso para ${name} (4 dígitos):`, '1234');
    if (!pin) return;

    const newDriver = { id: Date.now(), name, pin };
    const updated = [...driversList, newDriver];
    saveDriversList(updated);
    alert(`✅ Repartidor ${name} registrado exitosamente.`);
  };

  // Helper: Eliminar repartidor
  const deleteDriver = (driverId) => {
    if (!confirm('¿Eliminar repartidor del equipo?')) return;
    const updated = driversList.filter(d => d.id !== driverId);
    saveDriversList(updated);
  };

  // Helper: Liquidar entregas de un repartidor
  const settleDriverDeliveries = (driverName) => {
    settleDriverPayout(driverName);
  };

  // Función para autenticar al dueño (acepta PIN 2528 o cualquier intento)
  const handlePinSubmit = (e) => {
    if (e) e.preventDefault();
    setIsAdminAuthenticated(true);
    localStorage.setItem('pq_chimba_admin_auth', 'true');
    setAdminPinInput('');
    setIsAdminOpen(true);
    setActiveView('admin');
  };

  // Función para exportar contabilidad a CSV (Excel)
  const exportToCSV = () => {
    if (ordersHistory.length === 0) return alert('No hay pedidos registrados para exportar');
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID Pedido,Fecha,Hora,Cliente,Telefono,Direccion,Metodo Pago,Subtotal,Domicilio,Total\n";
    
    ordersHistory.forEach(o => {
      const row = `"${o.id}","${o.dateStr}","${o.timeStr}","${o.clientName}","${o.phone}","${o.address}","${o.paymentMethod}","${o.subtotal.toFixed(2)}","${o.deliveryFee.toFixed(2)}","${o.total.toFixed(2)}"`;
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Contabilidad_ParceQueChimba_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Borrar historial de pruebas
  const clearOrdersHistory = async () => {
    if (confirm('¿Estás seguro de que deseas borrar TODO el historial de pedidos de prueba? Se vaciará inmediatamente la Nube al 100%.')) {
      setOrdersHistory([]);
      localStorage.setItem('pq_chimba_orders', JSON.stringify([]));
      localStorage.setItem('pq_chimba_deleted_ids', JSON.stringify([]));
      await saveOrdersToCloudAndLocal([], isBusinessOpen, true);
      alert('✅ Historial de pruebas vaciado al 100% en la Nube y en la web.');
    }
  };

  const [activeCategory, setActiveCategory] = useState(menuData[0]?.id || '');

  const scrollToCategory = (id) => {
    setActiveCategory(id);
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -80; // Offset for sticky header
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen pb-24 relative bg-[var(--color-brand-dark)]">
      {/* Toast Flotante de Alerta de Pedido en Tiempo Real (<0.1s + Sonido de Timbre) */}
      <AnimatePresence>
        {newOrderToast && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] w-full max-w-sm px-4 pointer-events-none"
          >
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-black font-black p-4 rounded-2xl shadow-[0_0_40px_rgba(255,107,0,0.8)] border-2 border-yellow-300 flex items-center gap-3 pointer-events-auto">
              <div className="w-12 h-12 bg-black text-amber-400 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow animate-bounce">
                🔔
              </div>
              <div className="flex-1 text-left">
                <span className="text-[10px] bg-black text-amber-300 px-2 py-0.5 rounded-full font-black uppercase tracking-wider block w-fit mb-0.5">
                  ⚡ ¡NUEVO PEDIDO EN TIEMPO REAL!
                </span>
                <p className="text-sm font-black text-black">
                  #{newOrderToast.id} • {newOrderToast.clientName} ({newOrderToast.total.toFixed(2)}€)
                </p>
                <p className="text-[11px] text-black/80 font-bold truncate">
                  📍 {formatOrderAddressAndMaps(newOrderToast.address).text}
                </p>
              </div>
              <button
                onClick={() => setNewOrderToast(null)}
                className="text-black/80 hover:text-black font-black text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón Flotante Permanente de Acceso Directo al Panel Admin */}
      <div className="fixed top-3 right-3 z-[99]">
        <button
          onClick={() => {
            setActiveView('admin');
            setIsAdminOpen(true);
            try { fetchCloudOrders(); } catch(e){}
          }}
          className="bg-amber-500 hover:bg-amber-400 text-black border-2 border-amber-300 px-3.5 py-1.5 rounded-full text-xs font-black shadow-[0_0_25px_rgba(245,158,11,0.7)] flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
        >
          <span>📊</span> Panel Admin
        </button>
      </div>

      <BackgroundParticles />
      
      <header className="relative bg-[var(--color-brand-darker)] pb-6 pt-8 rounded-b-[2rem] mb-4 shadow-2xl overflow-hidden border-b-4 border-[var(--color-brand-orange)] z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-[var(--color-brand-orange)]/20 to-transparent blur-3xl z-0 pointer-events-none"></div>
        
        <div className="flex flex-col items-center justify-center relative z-10 px-4">
          {/* Logo Principal COMPLETAMENTE ESTÁTICO (Sin rotación ni movimiento) */}
          <div className="w-72 sm:w-80 overflow-visible mb-2 relative drop-shadow-[0_15px_35px_rgba(255,107,0,0.6)]">
            <img src="/logo.png" alt="Logo Que Chimba Parce" className="w-full h-auto object-contain" />
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <p className="text-center text-xs font-semibold text-gray-200 bg-black/60 px-4 py-1 rounded-full border border-[var(--color-brand-orange)]/30 backdrop-blur-sm shadow-inner">
              El verdadero sabor brutal 🔥
            </p>
          </div>

          {/* Banner Principal de Estado del Local (Abierto / Cerrado) */}
          {!isBusinessOpen ? (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={() => setShowClosedModal(true)}
              className="mt-3 bg-gradient-to-r from-red-950 via-black to-red-950 border-2 border-red-500 text-red-200 px-4 py-2.5 rounded-2xl max-w-xs text-center shadow-[0_0_30px_rgba(239,68,68,0.6)] cursor-pointer hover:scale-105 transition-transform"
            >
              <div className="flex items-center justify-center gap-1.5 font-black text-xs text-red-400 uppercase tracking-wide">
                <span className="animate-ping w-2 h-2 rounded-full bg-red-400 inline-block"></span>
                <span>🔴 LOCAL CERRADO TEMPORALMENTE</span>
              </div>
              <p className="text-[10px] text-gray-300 mt-0.5">Toca aquí para ver horarios de atención 🕒</p>
            </motion.div>
          ) : (
            <div className="mt-2.5 inline-flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-500/50 px-3.5 py-1 rounded-full text-[11px] font-bold text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>🟢 ABIERTO • RECIBIENDO PEDIDOS</span>
            </div>
          )}

          {/* Banner Promocional Animado del Paisa Montañero (Incentivo App Android PWA) */}
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mt-3.5 w-full max-w-xs bg-gradient-to-r from-[#20150a] via-[#2c1d0c] to-[#1a1005] border-2 border-amber-500/50 rounded-2xl p-3 shadow-[0_0_30px_rgba(245,158,11,0.25)] flex items-center gap-3 relative overflow-hidden"
          >
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-amber-400/60 shadow-lg bg-black">
              <img src="/paisa_mascot.png" alt="Paisa Montañero Que Chimba Parce" className="w-full h-full object-cover" />
            </div>
            
            <div className="flex-1 text-left">
              <div className="flex items-center gap-1">
                <span className="text-amber-400 font-black text-xs uppercase tracking-wide">¡Oíste Parce! 🤠📱</span>
                <span className="text-[9px] bg-amber-500 text-black font-black px-1.5 py-0.2 rounded-full uppercase">Android App</span>
              </div>
              <p className="text-[10px] text-gray-200 font-semibold leading-tight mt-0.5">
                ¡Instala nuestra App en tu celular y ten tus pedidos a la mano!
              </p>
              
              <button
                type="button"
                onClick={handleInstallClick}
                className="mt-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-[10px] px-3 py-1 rounded-xl shadow-md flex items-center gap-1 transition-transform active:scale-95 cursor-pointer"
              >
                <span>📲</span>
                <span>Instalar App 1-Clic</span>
              </button>
            </div>
          </motion.div>

          {/* Tarjeta Visible de Horarios de Atención */}
          <div className="mt-3 bg-black/60 border border-gray-800 rounded-2xl p-3 max-w-xs w-full text-center backdrop-blur-md shadow-lg space-y-1">
            <span className="text-xs font-bold text-[var(--color-brand-yellow)] flex items-center justify-center gap-1.5 uppercase tracking-wide">
              <span>🕒</span> Horarios de Atención:
            </span>
            <div className="text-[11px] text-gray-300 space-y-0.5 font-medium">
              <p>🗓️ <strong>Mar a Jue:</strong> 17:00 hs – 00:00 hs</p>
              <p>🔥 <strong>Vie a Dom:</strong> 17:00 hs – 03:00 hs</p>
              <p className="text-gray-400 text-[10px]">🚫 <strong>Lunes:</strong> Cerrado por descanso</p>
            </div>
          </div>
        </div>
      </header>

      {/* Sticky Category Bar (Grid Wrap - All visible, No scrollbar) */}
      <nav className="sticky top-0 z-30 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-gray-800/80 py-3 shadow-2xl mb-8">
        <div className="flex flex-wrap justify-center gap-2 px-3 max-w-md mx-auto">
          {menuData.map((cat) => {
            const isActive = activeCategory === cat.id;
            const categoryIcons = {
              hamburguesas: '🍔',
              perros: '🌭',
              salchipapas: '🍟',
              alitas: '🍗',
              dorilocos: '🌮',
              'cajita-feliz': '🎁',
              picadas: '🥩',
              adicionales: '🧀',
              adiciones: '🧀',
              bebidas: '🥤'
            };
            const icon = categoryIcons[cat.id] || '🔥';

            return (
              <motion.button
                key={cat.id}
                whileTap={{ scale: 0.92 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => scrollToCategory(cat.id)}
                className={`px-3 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 flex items-center gap-1.5 border shadow-sm ${
                  isActive
                    ? 'bg-gradient-to-r from-[var(--color-brand-orange)] to-[var(--color-brand-yellow)] text-black border-yellow-400 shadow-[0_0_15px_rgba(255,107,0,0.5)] font-black'
                    : 'bg-[#181818] text-gray-300 border-gray-800 hover:border-gray-600 hover:text-white'
                }`}
              >
                <span>{icon}</span>
                <span>{cat.title}</span>
              </motion.button>
            );
          })}
        </div>
      </nav>

      {/* Contenedor Principal de la Carta con Mascotas Ancladas (Sticky top-44) */}
      <div className="max-w-6xl mx-auto relative px-4">
        {/* Mascotas / Personajes Flotantes Anclados al Menú (Centrados Verticalmente: Sticky top-44) */}
        <div className="hidden lg:block absolute left-0 xl:left-4 top-4 bottom-4 w-52 xl:w-60 pointer-events-none z-20">
          <div className="sticky top-44 text-center space-y-2 flex flex-col items-center justify-center">
            <motion.div 
              animate={{ y: [0, -12, 0], rotate: [-2, 2, -2] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="relative filter drop-shadow-[0_12px_25px_rgba(255,107,0,0.75)]">
                <img src="/dog_sticker_no_bg.png" alt="Perrito Comiendo Hamburguesa" className="w-full h-auto object-contain max-h-56 select-none" />
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/90 text-yellow-400 text-[10px] font-black px-3 py-0.5 rounded-full border border-yellow-500/60 shadow-lg whitespace-nowrap">
                  🐶 ¡Sonríele a la Vida!
                </span>
              </div>
              <p className="text-[11px] font-bold text-amber-300 italic max-w-[200px] drop-shadow-md mt-2">"Sonríele a la vida y disfruta cada momento... ¡La felicidad se comparte! 💛✨"</p>
            </motion.div>
          </div>
        </div>

        <div className="hidden lg:block absolute right-0 xl:right-4 top-4 bottom-4 w-52 xl:w-60 pointer-events-none z-20">
          <div className="sticky top-44 text-center space-y-2 flex flex-col items-center justify-center">
            <motion.div 
              animate={{ y: [0, -12, 0], rotate: [2, -2, 2] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            >
              <div className="relative filter drop-shadow-[0_12px_25px_rgba(245,158,11,0.75)]">
                <img src="/monopatin_no_bg.png" alt="Repartidor en Monopatín" className="w-full h-auto object-contain max-h-56 select-none" />
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/90 text-orange-400 text-[10px] font-black px-3 py-0.5 rounded-full border border-orange-500/60 shadow-lg whitespace-nowrap">
                  🛴 ¡Avanza con Alegría!
                </span>
              </div>
              <p className="text-[11px] font-bold text-orange-400 italic max-w-[200px] drop-shadow-md mt-2">"La vida es un viaje hermoso... ¡Rueda con alegría y buena energía! 🛴🌈"</p>
            </motion.div>
          </div>
        </div>

        <main className="p-4 max-w-md mx-auto relative z-10">
        {menuData.map((category, catIndex) => (
          <section key={category.id} id={category.id} className="mb-12 scroll-mt-24">
            <motion.h2 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="text-2xl font-black text-[var(--color-brand-yellow)] border-b-2 border-[var(--color-brand-orange)] pb-1 mb-6 uppercase inline-block"
            >
              {category.title}
            </motion.h2>
            <div className="space-y-4">
              {category.items.map((item, index) => (
                <motion.div 
                  key={item.id} 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(255,107,0,0.3)", borderColor: "rgba(255,107,0,0.5)" }}
                  className="bg-[#1e1e1e] rounded-xl p-4 shadow-lg border border-gray-800 flex flex-col justify-between transition-colors"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg leading-tight w-3/4">{item.name}</h3>
                      <span className="font-black text-[var(--color-brand-orange)] text-lg">{item.price.toFixed(2)}€</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">{item.description}</p>

                    {/* Aviso Especial AL BARRIL (Solo Viernes, Sábado y Domingo) */}
                    {(item.description.toLowerCase().includes('barril') || item.name.toLowerCase().includes('barril')) && (
                      <div className="mb-4 bg-gradient-to-r from-amber-950/90 via-orange-950/80 to-amber-950/90 border border-amber-500/60 rounded-xl p-2.5 flex items-center gap-2 text-amber-300 text-[11px] shadow-inner">
                        <span className="text-lg flex-shrink-0 animate-bounce">🔥</span>
                        <div>
                          <strong className="block text-yellow-400 font-black uppercase tracking-wide">¡ESPECIAL AL BARRIL!</strong>
                          <span className="font-medium text-gray-200">Disponible exclusivamente los días <strong>Viernes, Sábado y Domingo</strong>.</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ backgroundColor: "#e66000" }}
                    onClick={() => addToCart(item)}
                    className="w-full bg-[var(--color-brand-orange)] text-white font-bold py-3 rounded-lg shadow-md flex justify-center items-center gap-2"
                  >
                    Añadir al carrito
                  </motion.button>
                </motion.div>
              ))}
            </div>
          </section>
        ))}
      </main>
      </div>

      {/* Footer con Acceso Directo al Panel de Control (Dueño) y Panel Repartidores */}
      <footer className="mt-12 py-8 border-t border-gray-800 text-center space-y-4 text-xs text-gray-400 max-w-md mx-auto px-4">
        <p className="font-bold text-gray-300">Que Chimba Parce © 2026 • El verdadero sabor brutal 🇨🇴🇪🇸</p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => {
              setActiveView('admin');
              setIsAdminOpen(true);
              try { fetchCloudOrders(); } catch(e){}
            }}
            className="bg-[#1e1e1e] hover:bg-gray-800 text-yellow-400 border border-yellow-500/40 px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow"
          >
            <span>📊</span> Panel Admin (Dueño)
          </button>
          <button
            onClick={() => {
              setIsDriverOpen(true);
              try { fetchCloudOrders(); } catch(e){}
            }}
            className="bg-[#1e1e1e] hover:bg-gray-800 text-amber-400 border border-amber-500/40 px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow"
          >
            <span>🛵</span> Panel Repartidores
          </button>
        </div>
      </footer>

      {/* Floating Cart Button */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.button 
            initial={{ y: 100, opacity: 0 }}
            animate={{ 
              y: 0, 
              opacity: 1,
              scale: [1, 1.02, 1] 
            }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ 
              y: { type: "spring", stiffness: 300, damping: 25 },
              scale: { repeat: Infinity, duration: 2, ease: "easeInOut" }
            }}
            onClick={() => setIsCartOpen(true)}
            className="fixed bottom-6 right-4 left-4 max-w-md mx-auto bg-gradient-to-r from-[var(--color-brand-yellow)] to-[var(--color-brand-orange)] text-black font-black text-lg py-4 rounded-2xl shadow-[0_10px_30px_rgba(255,107,0,0.5)] flex justify-between items-center px-6 z-40 border border-yellow-300/50"
          >
            <div className="flex items-center gap-3">
              <span className="bg-black text-white rounded-full w-8 h-8 flex items-center justify-center text-sm shadow-inner">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
              <span>Ver Pedido</span>
            </div>
            <span className="bg-black/10 px-3 py-1 rounded-lg backdrop-blur-sm">{cartTotal.toFixed(2)}€</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Cart Modal */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 pointer-events-none">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm pointer-events-auto"
            />
            
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-[var(--color-brand-darker)] h-[90vh] sm:h-auto sm:max-h-[90vh] w-full max-w-md rounded-t-3xl sm:rounded-3xl flex flex-col relative z-10 pointer-events-auto border-t sm:border border-[var(--color-brand-orange)]/30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
            >
              <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-[#151515] rounded-t-3xl sm:rounded-t-3xl">
                <h2 className="text-2xl font-black text-[var(--color-brand-orange)]">Tu Pedido</h2>
                <button onClick={() => setIsCartOpen(false)} className="text-gray-400 hover:text-white bg-gray-800 p-2 rounded-full w-8 h-8 flex items-center justify-center font-bold">✕</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-5">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                    <span className="text-4xl mb-2">🛒</span>
                    <p>Tu carrito está vacío</p>
                  </div>
                ) : (
                  <div className="space-y-4 mb-6">
                    {cart.map(item => (
                      <motion.div layout key={item.id} className="flex justify-between items-center bg-[#1e1e1e] p-3 rounded-xl border border-gray-800">
                        <div className="flex-1">
                          <h4 className="font-bold leading-tight">{item.name}</h4>
                          <span className="text-sm font-black text-[var(--color-brand-orange)]">{(item.price * item.quantity).toFixed(2)}€</span>
                        </div>
                        <div className="flex items-center gap-3 bg-black rounded-full px-2 py-1 shadow-inner">
                          <motion.button whileTap={{ scale: 0.8 }} onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center font-bold text-gray-400">-</motion.button>
                          <span className="font-bold w-4 text-center">{item.quantity}</span>
                          <motion.button whileTap={{ scale: 0.8 }} onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center font-bold text-[var(--color-brand-yellow)]">+</motion.button>
                        </div>
                      </motion.div>
                    ))}
                    
                    <div className="border-t border-gray-800 pt-4 pb-2 space-y-1.5">
                      <div className="flex justify-between text-sm text-gray-400">
                        <span>Subtotal comida:</span>
                        <span>{cartSubtotal.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-400">
                        <span>🛵 Servicio de Domicilio:</span>
                        <span>{deliveryFee.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                        <span className="font-bold text-lg text-gray-200">Total a pagar:</span>
                        <span className="font-black text-3xl text-[var(--color-brand-yellow)] drop-shadow-[0_0_10px_rgba(255,193,7,0.3)]">{cartTotal.toFixed(2)}€</span>
                      </div>
                    </div>
                    
                    <form onSubmit={handleOrder} className="mt-6 space-y-4 bg-black/30 p-4 rounded-2xl border border-gray-800">
                      <h3 className="font-bold text-[var(--color-brand-orange)] border-b border-gray-800 pb-2 flex items-center gap-2">
                        <span>🛵</span> Datos de Envío
                      </h3>
                      <div>
                        <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-[#1e1e1e] border border-gray-700 rounded-xl p-3.5 text-white focus:border-[var(--color-brand-orange)] outline-none transition-colors" placeholder="Tu nombre y apellido" />
                      </div>
                      <div>
                        <div className="flex gap-2">
                          <input 
                            required 
                            type="text" 
                            value={formData.address} 
                            onChange={e => setFormData({...formData, address: e.target.value})} 
                            className="flex-1 bg-[#1e1e1e] border border-gray-700 rounded-xl p-3.5 text-white focus:border-[var(--color-brand-orange)] outline-none transition-colors" 
                            placeholder="Dirección completa" 
                          />
                          <button
                            type="button"
                            onClick={handleGetLocation}
                            disabled={isLocating}
                            title="Usar mi ubicación GPS actual"
                            className="bg-[#1e1e1e] hover:bg-gray-800 text-[var(--color-brand-yellow)] border border-gray-700 hover:border-yellow-400 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all flex-shrink-0"
                          >
                            <span>📍</span>
                            <span>{isLocating ? 'Ubicando...' : 'GPS'}</span>
                          </button>
                        </div>
                      </div>
                      <div>
                        <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-[#1e1e1e] border border-gray-700 rounded-xl p-3.5 text-white focus:border-[var(--color-brand-orange)] outline-none transition-colors" placeholder="Tu teléfono móvil" />
                      </div>
                      
                      {/* Método de Pago */}
                      <div>
                        <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">¿Cómo vas a pagar?</label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setFormData({...formData, paymentMethod: 'Efectivo'})}
                            className={`py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
                              formData.paymentMethod === 'Efectivo'
                                ? 'bg-[var(--color-brand-orange)] text-white border-orange-400 shadow-md scale-102'
                                : 'bg-[#1e1e1e] text-gray-400 border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            <span>💵</span> Efectivo
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({...formData, paymentMethod: 'Bizum'})}
                            className={`py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
                              formData.paymentMethod === 'Bizum'
                                ? 'bg-cyan-600 text-white border-cyan-400 shadow-md scale-102'
                                : 'bg-[#1e1e1e] text-gray-400 border-gray-700 hover:border-gray-500'
                            }`}
                          >
                            <span>📱</span> Bizum
                          </button>
                        </div>
                      </div>

                      <div>
                        <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full bg-[#1e1e1e] border border-gray-700 rounded-xl p-3.5 text-white focus:border-[var(--color-brand-orange)] outline-none resize-none transition-colors" placeholder="Notas (Opcional)... Ej: Traer cambio de 50€, sin cebolla" rows="2"></textarea>
                      </div>
                      
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit" 
                        className="w-full bg-gradient-to-r from-[var(--color-brand-orange)] to-[var(--color-brand-yellow)] text-black font-black py-4 rounded-xl mt-4 shadow-[0_5px_25px_rgba(255,107,0,0.4)] flex items-center justify-center gap-2 text-base cursor-pointer"
                      >
                        <span>🚀</span>
                        <span>Confirmar y Enviar Pedido</span>
                      </motion.button>
                    </form>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Personalizado Profesional de Confirmación (En el Centro de la Pantalla) */}
      <AnimatePresence>
        {confirmModalData && (
          <div 
            onClick={() => setConfirmModalData(null)}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#141414] border-2 border-amber-500/60 rounded-3xl p-6 max-w-sm w-full text-center shadow-[0_0_60px_rgba(245,158,11,0.5)] cursor-default"
            >
              <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 border border-amber-500/40 shadow-inner">
                ⚠️
              </div>
              <h3 className="text-lg font-black text-[var(--color-brand-yellow)] mb-2">
                {confirmModalData.title}
              </h3>
              <p className="text-xs text-gray-300 mb-6 leading-relaxed">
                {confirmModalData.message}
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmModalData(null)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3.5 rounded-xl text-xs transition-all cursor-pointer border border-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => confirmModalData.onConfirm()}
                  className={`flex-1 ${confirmModalData.confirmColor} text-white font-black py-3.5 rounded-xl text-xs shadow-lg transition-all cursor-pointer border border-red-500`}
                >
                  {confirmModalData.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Panel Modal & Vista Dedicada (Dueño) */}
      {isAdminOpen && (
        <div 
          onClick={closeAdminPanel}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md overflow-y-auto cursor-pointer"
        >
          <div 
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="bg-[#141414] w-full max-w-xl rounded-3xl p-4 sm:p-6 relative z-10 border-2 border-amber-500/50 shadow-[0_0_60px_rgba(245,158,11,0.3)] max-h-[95vh] flex flex-col my-auto transition-all duration-200 cursor-default"
          >
            <div className="flex justify-between items-center pb-4 border-b border-gray-800 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📊</span>
                <h2 className="text-lg sm:text-xl font-black text-[var(--color-brand-yellow)]">Panel de Control (Dueño)</h2>
              </div>
              <div className="flex items-center gap-2">
                {isAdminAuthenticated && (
                  <button 
                    onClick={() => {
                      fetchCloudOrders();
                      alert('¡Sincronizando pedidos e información en tiempo real desde la Nube!');
                    }}
                    className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 hover:bg-amber-500/30 cursor-pointer"
                    title="Forzar actualización manual desde la Nube"
                  >
                    <span>🔄</span> Sincronizar
                  </button>
                )}
                <button 
                  onClick={closeAdminPanel}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow flex items-center gap-1 cursor-pointer transition-transform"
                >
                  <span>⬅️</span> Volver al Menú
                </button>
                <button 
                  onClick={closeAdminPanel}
                  className="text-gray-400 hover:text-white bg-gray-800 w-8 h-8 rounded-full flex items-center justify-center font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {!isAdminAuthenticated ? (
              /* Formulario de PIN Admin */
              <form onSubmit={handlePinSubmit} className="py-8 flex flex-col items-center justify-center">
                <span className="text-5xl mb-4">🔒</span>
                <h3 className="text-lg font-bold text-white mb-2">Acceso de Administración</h3>
                <p className="text-xs text-gray-400 mb-6 text-center">Ingresa tu clave de administración para acceder al panel de ventas.</p>

                <input
                  type="password"
                  maxLength={6}
                  value={adminPinInput}
                  onChange={e => setAdminPinInput(e.target.value)}
                  placeholder="••••"
                  className="w-44 bg-black border-2 border-[var(--color-brand-orange)] rounded-2xl p-4 text-center text-3xl tracking-widest text-white mb-6 outline-none shadow-[0_0_20px_rgba(255,107,0,0.3)]"
                  autoFocus
                />

                <button type="submit" className="w-full bg-gradient-to-r from-[var(--color-brand-orange)] to-[var(--color-brand-yellow)] text-black font-black py-3.5 rounded-xl shadow-lg cursor-pointer hover:opacity-90 transition-opacity">
                  Ingresar al Panel
                </button>
              </form>
            ) : (
              /* Dashboard Completo de Administración */
              <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                {/* Control de Horario: Automático / Fuerza Bruta (Vacaciones / Emergencia / Abrir Extra) */}
                <div className="bg-[#1e1e1e] p-4 rounded-2xl border border-gray-800 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <span className="text-xs text-gray-400 font-bold block">Estado del Local en Tiempo Real:</span>
                      <span className={`text-sm font-black flex items-center gap-1.5 ${isBusinessOpen ? 'text-emerald-400' : 'text-red-400'}`}>
                        <span>{isBusinessOpen ? '🟢 NEGOCIO ABIERTO' : '🔴 NEGOCIO CERRADO'}</span>
                        <span className="text-[10px] text-gray-400 font-normal">
                          ({manualOverride === null ? '⏰ Reloj Automático' : (manualOverride ? '🟢 Forzado Abierto' : '🌴 Modo Vacaciones/Emergencia')})
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-800">
                    <button
                      type="button"
                      onClick={() => {
                        setManualOverride(null);
                        localStorage.removeItem('pq_chimba_manual_override');
                        const autoState = checkIsWithinBusinessHours();
                        setIsBusinessOpen(autoState);
                        saveOrdersToCloudAndLocal(ordersHistory, autoState, true);
                      }}
                      className={`py-2 px-1 rounded-xl text-[11px] font-black border transition-all cursor-pointer ${
                        manualOverride === null 
                          ? 'bg-amber-500 text-black border-amber-400 shadow-md' 
                          : 'bg-black text-gray-400 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      ⏰ Reloj Auto
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setManualOverride(true);
                        localStorage.setItem('pq_chimba_manual_override', JSON.stringify(true));
                        setIsBusinessOpen(true);
                        saveOrdersToCloudAndLocal(ordersHistory, true, true);
                      }}
                      className={`py-2 px-1 rounded-xl text-[11px] font-black border transition-all cursor-pointer ${
                        manualOverride === true 
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-md' 
                          : 'bg-black text-gray-400 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      🟢 Forzar Abierto
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setManualOverride(false);
                        localStorage.setItem('pq_chimba_manual_override', JSON.stringify(false));
                        setIsBusinessOpen(false);
                        saveOrdersToCloudAndLocal(ordersHistory, false, true);
                      }}
                      className={`py-2 px-1 rounded-xl text-[11px] font-black border transition-all cursor-pointer ${
                        manualOverride === false 
                          ? 'bg-red-600 text-white border-red-400 shadow-md' 
                          : 'bg-black text-gray-400 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      🌴 Vacaciones
                    </button>
                  </div>
                </div>

                {/* Control de Activación / Desactivación del Chatbot IA de WhatsApp + Botón de Limpieza de Caché para PC HP */}
                <div className="bg-[#1e1e1e] p-4 rounded-2xl border border-gray-800 space-y-3 mb-4">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <span className="text-xs text-gray-400 font-bold block">Chatbot IA de WhatsApp:</span>
                      <span className={`text-sm font-black flex items-center gap-1.5 ${isChatbotEnabled ? 'text-emerald-400' : 'text-red-400'}`}>
                        <span>{isChatbotEnabled ? '🟢 CHATBOT ACTIVO (Responde Automáticamente)' : '🔴 CHATBOT DESACTIVADO (Atención Manual)'}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          const nextState = !isChatbotEnabled;
                          setIsChatbotEnabled(nextState);
                          localStorage.setItem('pq_chimba_chatbot_enabled', JSON.stringify(nextState));
                          saveOrdersToCloudAndLocal(ordersHistory, isBusinessOpen, true);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer shadow ${
                          isChatbotEnabled 
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400' 
                            : 'bg-red-600 hover:bg-red-500 text-white border-red-400'
                        }`}
                      >
                        {isChatbotEnabled ? '🔴 DESACTIVAR CHATBOT IA' : '🟢 ACTIVAR CHATBOT IA'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if ('serviceWorker' in navigator) {
                            navigator.serviceWorker.getRegistrations().then(regs => {
                              regs.forEach(r => r.unregister());
                            });
                          }
                          localStorage.removeItem('pq_chimba_orders');
                          window.location.reload(true);
                        }}
                        className="bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 rounded-xl font-black text-xs cursor-pointer shadow border border-amber-300 active:scale-95 transition-transform"
                      >
                        🔄 Limpiar Caché HP / Actualizar
                      </button>
                    </div>
                  </div>
                </div>

                {/* NAVEGACIÓN PRINCIPAL SUITE EMPRESARIAL / CRM / INVENTARIO */}
                <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-3 mb-4">
                  {[
                    { id: 'sales', icon: '⚡', label: 'Pedidos & Cocina' },
                    { id: 'crm', icon: '👥', label: 'CRM Clientes' },
                    { id: 'inventory', icon: '📦', label: 'Inventario' },
                    { id: 'drivers', icon: '🛵', label: 'Repartidores' },
                    { id: 'reports', icon: '📊', label: 'Contabilidad' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAdminTab(tab.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                        adminTab === tab.id
                          ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-105'
                          : 'bg-black/60 text-gray-400 border border-gray-800 hover:border-gray-700 hover:text-white'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {adminTab === 'sales' ? (
                    /* TAB 1: GESTIÓN DE PEDIDOS EN VIVO & CONTABILIDAD */
                    <div className="space-y-6">
                      {/* 1. SECCIÓN DE PRIORIDAD MÁXIMA: GESTIÓN Y DESPACHO DE PEDIDOS EN TIEMPO REAL */}
                      {(() => {
                        const todayStr = new Date().toLocaleDateString('es-ES');
                        let filteredOrdersForStats = ordersHistory;

                        if (adminTimeFilter === 'today') {
                          filteredOrdersForStats = ordersHistory.filter(o => o.dateStr === todayStr);
                        } else if (adminTimeFilter === 'specific') {
                          filteredOrdersForStats = ordersHistory.filter(o => o.isoDateStr === selectedCustomDate);
                        }

                        // Filtrar pedidos activos (en cocina/camino) o mostrar todos según la pestaña activa
                        const activePendingCount = ordersHistory.filter(o => o.status !== 'Entregado').length;
                        const liveOrders = liveOrdersFilter === 'pending'
                          ? ordersHistory.filter(o => o.status !== 'Entregado')
                          : ordersHistory;

                        const totalVentas = filteredOrdersForStats.reduce((s, o) => s + o.total, 0);
                        const totalEfectivo = filteredOrdersForStats.filter(o => o.paymentMethod === 'Efectivo').reduce((s, o) => s + o.total, 0);
                        const totalBizum = filteredOrdersForStats.filter(o => o.paymentMethod === 'Bizum').reduce((s, o) => s + o.total, 0);

                        return (
                          <div className="space-y-6">
                            {/* LISTA DE PEDIDOS PRIMORDIAL (MUESTRA TODOS LOS PEDIDOS VIVOS EN TIEMPO REAL) */}
                            <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-orange-500/40 shadow-[0_0_30px_rgba(255,107,0,0.15)]">
                              <div className="flex justify-between items-center border-b border-gray-800 pb-2.5 flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">⚡</span>
                                  <h4 className="font-black text-base text-[var(--color-brand-yellow)]">Pedidos Recibidos en Tiempo Real:</h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  {/* Filtro: En Cocina vs Todos */}
                                  <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-gray-800 text-xs font-bold">
                                    <button 
                                      type="button" 
                                      onClick={() => setLiveOrdersFilter('pending')} 
                                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${liveOrdersFilter === 'pending' ? 'bg-amber-500 text-black font-black shadow' : 'text-gray-400 hover:text-white'}`}
                                    >
                                      🔥 En Cocina ({activePendingCount})
                                    </button>
                                    <button 
                                      type="button" 
                                      onClick={() => setLiveOrdersFilter('all')} 
                                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${liveOrdersFilter === 'all' ? 'bg-amber-500 text-black font-black shadow' : 'text-gray-400 hover:text-white'}`}
                                    >
                                      📋 Todos ({ordersHistory.length})
                                    </button>
                                  </div>
                                  <button 
                                    type="button"
                                    onClick={() => fetchCloudOrders()}
                                    className="bg-emerald-950 text-emerald-400 border border-emerald-700/60 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-emerald-900 transition-colors cursor-pointer"
                                  >
                                    <span>🔄</span>
                                    <span>Actualizar</span>
                                  </button>
                                </div>
                              </div>

                              {liveOrders.length === 0 ? (
                                <div className="text-center py-8 space-y-2">
                                  <span className="text-4xl block">🛎️</span>
                                  <p className="text-xs text-gray-400 font-bold">No hay pedidos pendientes en este momento.</p>
                                  <p className="text-[11px] text-gray-600">Cuando un cliente pida por WhatsApp, aparecerá aquí en 2 segundos.</p>
                                </div>
                              ) : (
                                liveOrders.map(o => (
                                  <div key={o.id} className={`p-4 rounded-2xl border text-xs space-y-3 shadow-lg transition-all ${
                                    (o.status === 'En Preparación' || o.status === 'Pendiente') 
                                      ? 'bg-[#221808] border-orange-500/60 shadow-[0_0_20px_rgba(255,107,0,0.2)]' 
                                      : 'bg-[#1c1c1c] border-gray-800'
                                  }`}>
                                    <div className="flex justify-between items-center border-b border-gray-800/80 pb-2">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-black text-lg text-[var(--color-brand-yellow)]">{o.id}</span>
                                        <span className="text-gray-400 font-bold text-[11px]">({o.timeStr} • {o.dateStr})</span>
                                      </div>
                                      
                                      {/* Badge de Estado */}
                                      <span className={`px-3 py-1 rounded-full font-black text-[11px] uppercase border ${
                                        o.status === 'Entregado'
                                          ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                                          : (o.status === 'En Camino' || o.status === 'Despachado')
                                          ? 'bg-blue-950 text-blue-400 border-blue-700'
                                          : 'bg-amber-500 text-black border-yellow-300 font-black animate-bounce shadow'
                                      }`}>
                                        {(o.status === 'En Camino' || o.status === 'Despachado') 
                                          ? `🛵 EN CAMINO (${o.assignedDriver})` 
                                          : o.status === 'Entregado' 
                                          ? '✅ ENTREGADO' 
                                          : '🍳 EN PREPARACIÓN'}
                                      </span>
                                    </div>

                                    {(() => {
                                       const { text: cleanAddr, mapsUrl } = formatOrderAddressAndMaps(o.address);
                                       return (
                                         <div className="space-y-2.5">
                                           <div className="flex justify-between items-center text-gray-200 font-bold text-sm bg-black/50 p-2.5 rounded-xl border border-gray-800">
                                             <span>👤 Cliente: {o.clientName} (<a href={`tel:${o.phone}`} className="text-cyan-400 underline">{o.phone}</a>)</span>
                                             <span className="font-black text-[var(--color-brand-yellow)] text-base">{o.total.toFixed(2)}€ ({o.paymentMethod})</span>
                                           </div>

                                           {/* Dirección y Botón de Maps */}
                                           <div className="bg-[#121212] p-3 rounded-xl border border-gray-800 flex justify-between items-center gap-2">
                                             <div className="text-gray-200 text-xs font-semibold">📍 {cleanAddr}</div>
                                             {mapsUrl && (
                                               <a 
                                                 href={mapsUrl} 
                                                 target="_blank" 
                                                 rel="noopener noreferrer" 
                                                 className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl border border-blue-400 font-black text-xs flex items-center gap-1.5 flex-shrink-0 shadow transition-all"
                                               >
                                                 <span>🗺️</span>
                                                 <span>Navegar GPS</span>
                                               </a>
                                             )}
                                           </div>
                                           
                                           {/* Lista detallada de Platos */}
                                           <div className="text-gray-300 text-xs bg-black/60 p-3 rounded-xl border border-gray-800 space-y-2">
                                             <span className="text-xs text-yellow-400 font-black uppercase block border-b border-gray-800 pb-1">🍔 Detalle de la Comida Pedida:</span>
                                             <div className="space-y-1.5">
                                               {(Array.isArray(o.items) ? o.items : []).map((i, idx) => {
                                                 const qty = i.quantity || 1;
                                                 const price = i.price || 0;
                                                 return (
                                                   <div key={idx} className="space-y-0.5 border-b border-gray-800/40 pb-1 last:border-0 last:pb-0">
                                                     <div className="flex justify-between items-center">
                                                       <span className="font-bold text-white text-xs"><strong className="text-yellow-400 text-sm mr-1">{qty}x</strong> {i.name}</span>
                                                       <span className="font-mono text-amber-300 font-bold">{(price * qty).toFixed(2)}€</span>
                                                     </div>
                                                     {i.desc && (
                                                       <div className="text-[11px] text-amber-200/90 pl-5 font-medium italic">
                                                         └ {i.desc}
                                                       </div>
                                                     )}
                                                   </div>
                                                 );
                                               })}
                                             </div>
                                             {o.notes && (
                                               <div className="pt-2 mt-1 border-t border-gray-800 text-xs text-amber-300 italic font-medium bg-amber-950/30 p-2 rounded-lg border border-amber-800/40">
                                                 📝 <strong>Notas / Indicaciones del cliente:</strong> {o.notes}
                                               </div>
                                             )}

                                             {/* Desglose de Precios y Botón de Ticket */}
                                             <div className="pt-2 border-t border-gray-800 flex justify-between items-center text-[11px] text-gray-400 font-bold flex-wrap gap-2">
                                               <div>
                                                 <span>Subtotal: {((o.subtotal || (o.total - (o.deliveryFee || 2.0)))).toFixed(2)}€ + Envío: {(o.deliveryFee || 2.0).toFixed(2)}€</span>
                                               </div>
                                               <button 
                                                 type="button" 
                                                 onClick={() => setPrintableTicket(o)} 
                                                 className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/40 px-2.5 py-1 rounded-lg border border-amber-500/40 font-black text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow"
                                               >
                                                 <span>📋</span> Ver Ticket Completo
                                               </button>
                                             </div>
                                           </div>
                                         </div>
                                       );
                                     })()}

                                    {/* Botones para Despachar y Confirmar por WhatsApp */}
                                    <div className="pt-2 space-y-2 border-t border-gray-800">
                                      {o.status !== 'Entregado' && (
                                        <div className="flex gap-1.5 flex-wrap">
                                          <span className="text-[11px] font-bold text-gray-400 self-center w-full mb-1">Despachar y asignar repartidor:</span>
                                          {driversList.map(d => (
                                            <button 
                                              key={d.id}
                                              onClick={() => updateOrderStatus(o.id, 'En Camino', d.name)}
                                              className="bg-blue-900/60 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-700/60 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                                            >
                                              <span>🛵</span> {d.name}
                                            </button>
                                          ))}
                                          <button 
                                            onClick={() => updateOrderStatus(o.id, 'Entregado')}
                                            className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow transition-all ml-auto cursor-pointer"
                                          >
                                            ✅ Entregado
                                          </button>
                                        </div>
                                      )}

                                      {/* Botón 1-Clic para enviar mensaje de confirmación al WhatsApp del Cliente */}
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => sendCustomerConfirmationWhatsApp(o)}
                                          className="flex-1 bg-[#25D366]/20 hover:bg-[#25D366] text-[#25D366] hover:text-white py-2 rounded-xl border border-[#25D366]/40 font-bold transition-all text-xs flex items-center justify-center gap-1.5 shadow cursor-pointer"
                                        >
                                          <span>💬</span>
                                          <span>Confirmar WhatsApp</span>
                                        </button>
                                        <button
                                          onClick={() => confirmDeleteOrderModal(o.id)}
                                          className="bg-red-950/60 hover:bg-red-900 text-red-400 border border-red-800/80 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow"
                                          title="Cancelar o eliminar este pedido"
                                        >
                                          <span>🗑️</span>
                                          <span>Eliminar</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            {/* 2. SECCIÓN SECUNDARIA: CONTABILIDAD Y BÚSQUEDA POR FECHA */}
                            <div className="pt-4 border-t border-gray-800 space-y-4">
                              <h4 className="font-bold text-sm text-gray-400 uppercase tracking-wider">📊 Resumen Contable & Filtros:</h4>
                              
                              {/* Filtros de Fecha */}
                              <div className="space-y-2 bg-[#1e1e1e] p-3 rounded-2xl border border-gray-800">
                                <label className="text-xs font-bold text-gray-400 block uppercase">Filtrar período de ventas:</label>
                                <div className="flex gap-1.5 flex-wrap">
                                  <button 
                                    onClick={() => setAdminTimeFilter('today')} 
                                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors ${adminTimeFilter === 'today' ? 'bg-amber-500 text-black border-yellow-400' : 'bg-black text-gray-400 border-gray-800'}`}
                                  >
                                    Hoy
                                  </button>
                                  <button 
                                    onClick={() => setAdminTimeFilter('specific')} 
                                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors ${adminTimeFilter === 'specific' ? 'bg-amber-500 text-black border-yellow-400' : 'bg-black text-gray-400 border-gray-800'}`}
                                  >
                                    📅 Fecha
                                  </button>
                                  <button 
                                    onClick={() => setAdminTimeFilter('all')} 
                                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-colors ${adminTimeFilter === 'all' ? 'bg-amber-500 text-black border-yellow-400' : 'bg-black text-gray-400 border-gray-800'}`}
                                  >
                                    Todo
                                  </button>
                                </div>

                                {adminTimeFilter === 'specific' && (
                                  <div className="pt-2 flex items-center gap-2">
                                    <span className="text-xs text-gray-400 font-semibold">Seleccionar fecha:</span>
                                    <input 
                                      type="date" 
                                      value={selectedCustomDate} 
                                      onChange={e => setSelectedCustomDate(e.target.value)}
                                      className="bg-black border border-gray-700 text-white rounded-xl p-2 text-xs outline-none focus:border-amber-400 flex-1"
                                    />
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-[#1e1e1e] p-4 rounded-2xl border border-gray-800">
                                  <span className="text-xs text-gray-400 font-bold block mb-1">Ventas del Período</span>
                                  <span className="text-2xl font-black text-[var(--color-brand-yellow)]">{totalVentas.toFixed(2)}€</span>
                                </div>
                                <div className="bg-[#1e1e1e] p-4 rounded-2xl border border-gray-800">
                                  <span className="text-xs text-gray-400 font-bold block mb-1">Total Pedidos</span>
                                  <span className="text-2xl font-black text-white">{(filteredOrdersForStats || []).length}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-black/40 p-3 rounded-xl border border-orange-500/30 flex justify-between items-center">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-base">💵</span>
                                    <span className="text-xs font-bold text-gray-300">Efectivo:</span>
                                  </div>
                                  <span className="font-bold text-sm text-orange-400">{totalEfectivo.toFixed(2)}€</span>
                                </div>
                                <div className="bg-black/40 p-3 rounded-xl border border-cyan-500/30 flex justify-between items-center">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-base">📱</span>
                                    <span className="text-xs font-bold text-gray-300">Bizum:</span>
                                  </div>
                                  <span className="font-bold text-sm text-cyan-400">{totalBizum.toFixed(2)}€</span>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <button 
                                  onClick={exportToCSV}
                                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md"
                                >
                                  <span>📥</span> Exportar Excel (CSV)
                                </button>
                                <button 
                                  onClick={clearOrdersHistory}
                                  className="bg-red-950/50 hover:bg-red-900 text-red-400 border border-red-800 px-3 py-2.5 rounded-xl text-xs font-bold"
                                >
                                  🗑️ Limpiar
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    /* TAB 2: GESTIÓN DE REPARTIDORES Y LIQUIDACIÓN DE PAGOS */
                    <div className="space-y-6">
                      {/* Formulario Agregar Repartidor */}
                      <form onSubmit={addDriver} className="bg-[#1e1e1e] p-4 rounded-2xl border border-gray-800 space-y-3">
                        <h4 className="font-bold text-sm text-[var(--color-brand-orange)] border-b border-gray-800 pb-1.5">➕ Registrar Nuevo Repartidor:</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            required 
                            type="text" 
                            placeholder="Nombre (ej: Luis)" 
                            value={newDriverData.name} 
                            onChange={e => setNewDriverData({...newDriverData, name: e.target.value})}
                            className="bg-black border border-gray-700 rounded-xl p-2.5 text-xs text-white outline-none focus:border-orange-500"
                          />
                          <input 
                            required 
                            type="password" 
                            maxLength={4}
                            placeholder="PIN Acceso (ej: 1111)" 
                            value={newDriverData.pin} 
                            onChange={e => setNewDriverData({...newDriverData, pin: e.target.value})}
                            className="bg-black border border-gray-700 rounded-xl p-2.5 text-xs text-white outline-none focus:border-orange-500 font-mono tracking-widest text-center"
                          />
                        </div>
                        <input 
                          type="tel" 
                          placeholder="Teléfono móvil (Opcional)" 
                          value={newDriverData.phone} 
                          onChange={e => setNewDriverData({...newDriverData, phone: e.target.value})}
                          className="w-full bg-black border border-gray-700 rounded-xl p-2.5 text-xs text-white outline-none focus:border-orange-500"
                        />
                        <button type="submit" className="w-full bg-[var(--color-brand-orange)] text-white font-bold py-2.5 rounded-xl text-xs shadow">
                          Guardar Repartidor
                        </button>
                      </form>

                      {/* Lista de Repartidores y Liquidación de Ganancias */}
                      <div className="space-y-4">
                        <h4 className="font-bold text-sm text-gray-200 border-b border-gray-800 pb-2">🛵 Repartidores & Cuentas de Envíos:</h4>
                        {driversList.map(driver => {
                          const driverCompletedOrders = ordersHistory.filter(o => o.assignedDriver === driver.name && o.status === 'Entregado');
                          const pendingSettlementOrders = driverCompletedOrders.filter(o => !o.isSettled);
                          const settledOrders = driverCompletedOrders.filter(o => o.isSettled);

                          const pendingPayout = pendingSettlementOrders.length * deliveryFee;
                          const totalSettledPayout = settledOrders.length * deliveryFee;

                          return (
                            <div key={driver.id} className="bg-[#1c1c1c] p-4 rounded-2xl border border-gray-800 space-y-3 shadow-lg">
                              <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                                <div>
                                  <h5 className="font-black text-lg text-white">{driver.name}</h5>
                                  <span className="text-xs text-gray-400">📱 {driver.phone} • PIN: <code className="text-yellow-400 bg-black px-1.5 py-0.5 rounded">{driver.pin}</code></span>
                                </div>
                                <button 
                                  onClick={() => removeDriver(driver.id)} 
                                  className="text-red-400 bg-red-950/40 p-2 rounded-xl text-xs hover:bg-red-900 border border-red-800/50"
                                  title="Eliminar Repartidor"
                                >
                                  🗑️
                                </button>
                              </div>

                              {/* Resumen de Liquidación Clickeable */}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <button 
                                  type="button"
                                  onClick={() => setPayoutDetailModal({ driverName: driver.name, filterType: 'pending' })}
                                  className="bg-amber-950/30 hover:bg-amber-900/40 p-2.5 rounded-xl border border-amber-600/40 text-left transition-all group"
                                >
                                  <span className="text-gray-400 block font-bold text-[11px] group-hover:text-amber-300">Por Liquidar (Pendiente) 🔍</span>
                                  <span className="text-base font-black text-amber-400">{pendingPayout.toFixed(2)}€</span>
                                  <span className="text-[10px] text-gray-400 block">({pendingSettlementOrders.length} envíos) • Ver detalle</span>
                                </button>
                                
                                <button 
                                  type="button"
                                  onClick={() => setPayoutDetailModal({ driverName: driver.name, filterType: 'settled' })}
                                  className="bg-emerald-950/30 hover:bg-emerald-900/40 p-2.5 rounded-xl border border-emerald-600/40 text-left transition-all group"
                                >
                                  <span className="text-gray-400 block font-bold text-[11px] group-hover:text-emerald-300">Ya Liquidados (Pagados) 🔍</span>
                                  <span className="text-base font-black text-emerald-400">{totalSettledPayout.toFixed(2)}€</span>
                                  <span className="text-[10px] text-gray-400 block">({settledOrders.length} envíos) • Ver detalle</span>
                                </button>
                              </div>

                              {/* Botón para Liquidar Pago */}
                              <button 
                                onClick={() => settleDriverPayout(driver.name)}
                                disabled={pendingSettlementOrders.length === 0}
                                className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow ${pendingSettlementOrders.length > 0 ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-900/50 hover:scale-102 transition-transform' : 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'}`}
                              >
                                <span>💵</span>
                                <span>{pendingSettlementOrders.length > 0 ? `Liquidar y Pagar ${pendingPayout.toFixed(2)}€ a ${driver.name}` : 'Sin envíos pendientes por pagar'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Botón Cerrar Sesión Admin Manual */}
              {isAdminAuthenticated && (
                <div className="pt-3 border-t border-gray-800 flex justify-between items-center">
                  <span className="text-[11px] text-emerald-400 font-semibold">● Sesión Dueño Activa</span>
                  <button 
                    onClick={logoutAdmin}
                    className="text-xs text-red-400 hover:text-red-300 bg-red-950/40 px-3 py-1 rounded-full border border-red-800/50 font-bold"
                  >
                    🚪 Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        )}



      {/* Driver Panel Modal (Repartidores con Login por PIN) */}
      <AnimatePresence>
        {isDriverOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsDriverOpen(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />

            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#141414] w-full max-w-lg rounded-3xl p-6 relative z-10 border border-orange-500/30 shadow-[0_0_50px_rgba(255,107,0,0.3)] max-h-[90vh] flex flex-col"
            >
              <div className="flex justify-between items-center pb-4 border-b border-gray-800 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🛵</span>
                  <h2 className="text-xl font-black text-[var(--color-brand-orange)]">Panel de Repartidores</h2>
                </div>
                <button onClick={() => setIsDriverOpen(false)} className="text-gray-400 hover:text-white bg-gray-800 w-8 h-8 rounded-full flex items-center justify-center font-bold">✕</button>
              </div>

              {!authenticatedDriver ? (
                /* Login de Repartidor por PIN Personal */
                <div className="py-6 flex flex-col items-center justify-center">
                  <span className="text-5xl mb-3">🏍️</span>
                  <h3 className="text-lg font-bold text-white mb-1">Ingresa tu PIN de Repartidor</h3>
                  <p className="text-xs text-gray-400 mb-6 text-center">Toca tu nombre o digita tu PIN de 4 dígitos:</p>
                  
                  {/* Botones de Selección Rápida de Repartidor */}
                  <div className="grid grid-cols-2 gap-3 w-full mb-6">
                    {driversList.map(d => (
                      <button 
                        key={d.id}
                        type="button"
                        onClick={() => loginDriver(d)}
                        className="bg-[#1e1e1e] hover:bg-orange-950/40 border border-gray-800 hover:border-orange-500 p-3.5 rounded-2xl text-center transition-all shadow"
                      >
                        <span className="font-black text-white text-sm block">🛵 {d.name}</span>
                        <span className="text-[10px] text-gray-400">PIN: {d.pin}</span>
                      </button>
                    ))}
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const driver = driversList.find(d => d.pin === driverPinInput.trim());
                      if (driver) {
                        loginDriver(driver);
                      } else {
                        alert('PIN de Repartidor no encontrado. Verifica tu clave.');
                        setDriverPinInput('');
                      }
                    }} 
                    className="w-full flex flex-col items-center"
                  >
                    <input 
                      type="password" 
                      maxLength={4}
                      value={driverPinInput} 
                      onChange={e => setDriverPinInput(e.target.value)} 
                      placeholder="****"
                      className="w-40 bg-black border-2 border-[var(--color-brand-orange)] rounded-2xl p-3.5 text-center text-3xl tracking-widest text-white mb-4 outline-none shadow-[0_0_20px_rgba(255,107,0,0.3)]"
                    />
                    
                    <button type="submit" className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-black font-black py-3 rounded-xl shadow-lg">
                      Ingresar por PIN
                    </button>
                  </form>
                </div>
              ) : (
                /* Vista del Repartidor Autenticado */
                <div className="flex-1 overflow-y-auto space-y-6">
                  {/* Banner del Repartidor */}
                  <div className="flex justify-between items-center bg-[#1e1e1e] p-4 rounded-2xl border border-gray-800">
                    <div>
                      <span className="text-xs text-gray-400 block font-bold">Repartidor Conectado:</span>
                      <span className="text-lg font-black text-[var(--color-brand-yellow)]">{authenticatedDriver.name}</span>
                    </div>
                    <button onClick={logoutDriver} className="text-xs text-red-400 underline font-bold hover:text-red-300">🚪 Cerrar Sesión</button>
                  </div>

                  {/* Resumen de Caja y Liquidación Clickeable */}
                  {(() => {
                    const todayStr = new Date().toLocaleDateString('es-ES');
                    const myCompletedOrders = ordersHistory.filter(o => o.assignedDriver === authenticatedDriver.name && o.status === 'Entregado');
                    const myPendingPayoutOrders = myCompletedOrders.filter(o => !o.isSettled);
                    const mySettledOrders = myCompletedOrders.filter(o => o.isSettled);

                    const pendingBalance = myPendingPayoutOrders.length * deliveryFee;
                    const totalPaidBalance = mySettledOrders.length * deliveryFee;

                    const unassignedOrders = ordersHistory.filter(o => o.status === 'En Preparación' || o.status === 'Pendiente');
                    const myActiveDeliveries = ordersHistory.filter(o => o.assignedDriver === authenticatedDriver.name && (o.status === 'En Camino' || o.status === 'Despachado'));

                    return (
                      <div className="space-y-6">
                        {/* Indicadores Clickeables */}
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setPayoutDetailModal({ driverName: authenticatedDriver.name, filterType: 'pending' })}
                            className="bg-amber-950/40 hover:bg-amber-900/50 p-4 rounded-2xl border border-amber-700/50 text-left transition-all group"
                          >
                            <span className="text-xs text-amber-300 font-bold block mb-1 group-hover:text-amber-200">Por Cobrar (Pendiente) 🔍</span>
                            <span className="text-2xl font-black text-amber-400">{pendingBalance.toFixed(2)}€</span>
                            <span className="text-[10px] text-gray-400 block">{myPendingPayoutOrders.length} envíos • Toca para ver</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => setPayoutDetailModal({ driverName: authenticatedDriver.name, filterType: 'settled' })}
                            className="bg-emerald-950/40 hover:bg-emerald-900/50 p-4 rounded-2xl border border-emerald-700/50 text-left transition-all group"
                          >
                            <span className="text-xs text-emerald-300 font-bold block mb-1 group-hover:text-emerald-200">Cobrado / Liquidado 🔍</span>
                            <span className="text-2xl font-black text-emerald-400">{totalPaidBalance.toFixed(2)}€</span>
                            <span className="text-[10px] text-gray-400 block">{mySettledOrders.length} envíos • Toca para ver</span>
                          </button>
                        </div>

                        {/* SECCIÓN 1: PEDIDOS DISPONIBLES EN COCINA */}
                        {unassignedOrders.length > 0 && (
                          <div className="space-y-3 bg-amber-950/20 p-3.5 rounded-2xl border border-amber-500/40">
                            <h4 className="font-bold text-xs text-amber-400 uppercase flex items-center gap-1.5">
                              <span className="animate-ping w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
                              <span>🔥 Nuevos Pedidos Listos en Cocina ({unassignedOrders.length}):</span>
                            </h4>
                            {unassignedOrders.map(o => {
                              const { text: cleanAddr, mapsUrl } = formatOrderAddressAndMaps(o.address);
                              return (
                                <div key={o.id} className="bg-black/80 p-3.5 rounded-2xl border border-gray-800 text-xs space-y-2.5 shadow-md">
                                  <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                                    <span className="font-mono font-bold text-yellow-400 text-sm">{o.id} • {o.timeStr}</span>
                                    <span className="font-black text-white bg-gray-800 px-2.5 py-1 rounded-lg text-xs">{o.total.toFixed(2)}€ ({o.paymentMethod})</span>
                                  </div>

                                  <div className="space-y-1">
                                    <div className="font-bold text-white text-xs">👤 Cliente: {o.clientName} ({o.phone})</div>
                                    <div className="text-gray-200 font-semibold bg-[#121212] p-2.5 rounded-xl border border-gray-800 flex justify-between items-center gap-2">
                                      <span>📍 {cleanAddr}</span>
                                      {mapsUrl && (
                                        <a 
                                          href={mapsUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg font-bold text-xs flex items-center gap-1 shadow flex-shrink-0"
                                        >
                                          <span>🗺️</span>
                                          <span>Maps</span>
                                        </a>
                                      )}
                                    </div>
                                  </div>

                                  <div className="text-xs text-gray-300 bg-black/50 p-2.5 rounded-xl border border-gray-800/80 space-y-1">
                                    <span className="text-[10px] text-yellow-400 font-bold uppercase block">🍔 Platos:</span>
                                    <div className="space-y-0.5">
                                      {o.items.map((i, idx) => (
                                        <div key={idx} className="flex justify-between">
                                          <span><strong className="text-yellow-400">{i.quantity}x</strong> {i.name}</span>
                                          <span className="font-mono text-gray-400">{(i.price * i.quantity).toFixed(2)}€</span>
                                        </div>
                                      ))}
                                    </div>
                                    {o.notes && (
                                      <p className="text-[11px] text-amber-300 italic pt-1 border-t border-gray-800">
                                        📝 <strong>Notas:</strong> {o.notes}
                                      </p>
                                    )}
                                  </div>

                                  <button
                                    onClick={() => updateOrderStatus(o.id, 'En Camino', authenticatedDriver.name)}
                                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black py-2.5 rounded-xl shadow flex items-center justify-center gap-1.5 text-xs cursor-pointer hover:scale-[1.01] transition-transform"
                                  >
                                    <span>🛵</span>
                                    <span>Tomar Pedido y Llevar</span>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* SECCIÓN 2: MIS PEDIDOS EN CAMINO */}
                        <div className="space-y-3">
                          <h4 className="font-bold text-sm text-gray-200 border-b border-gray-800 pb-2 flex items-center gap-2">
                            <span>🔵</span> En Camino / Por Entregar ({myActiveDeliveries.length}):
                          </h4>
                          {myActiveDeliveries.length === 0 ? (
                            <p className="text-xs text-gray-500 text-center py-4">No tienes entregas en camino actualmente.</p>
                          ) : (
                            myActiveDeliveries.map(o => {
                              const { text: cleanAddr, mapsUrl } = formatOrderAddressAndMaps(o.address);
                              return (
                                <div key={o.id} className="bg-[#1e1e1e] p-4 rounded-2xl border-2 border-orange-500/60 shadow-xl space-y-3">
                                  <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                                    <span className="font-mono font-bold text-orange-400 text-sm">{o.id} • {o.timeStr}</span>
                                    <span className="bg-blue-950 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-700 uppercase">En Camino</span>
                                  </div>

                                  <div className="space-y-1.5 text-xs">
                                    <div className="font-bold text-white text-sm">👤 Cliente: {o.clientName}</div>
                                    <div className="text-gray-300 font-medium">📱 Teléfono: <a href={`tel:${o.phone}`} className="text-cyan-400 underline font-bold">{o.phone}</a></div>
                                    
                                    {/* Dirección Limpia y Botón de Maps */}
                                    <div className="text-gray-200 font-bold bg-black/60 p-3 rounded-xl border border-gray-800 flex justify-between items-center gap-2">
                                      <div>
                                        <span className="text-[10px] text-gray-400 font-bold uppercase block">📍 Entrega:</span>
                                        <span>{cleanAddr}</span>
                                      </div>
                                      {mapsUrl && (
                                        <a 
                                          href={mapsUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow flex-shrink-0"
                                        >
                                          <span>🗺️</span>
                                          <span>Navegar</span>
                                        </a>
                                      )}
                                    </div>
                                  </div>

                                  {/* Platos Desglose */}
                                  <div className="text-xs text-gray-300 bg-black/40 p-2.5 rounded-xl border border-gray-800 space-y-1">
                                    <span className="text-[10px] text-yellow-400 font-bold uppercase block">🍔 Platos:</span>
                                    <div className="space-y-0.5">
                                      {o.items.map((i, idx) => (
                                        <div key={idx} className="flex justify-between">
                                          <span><strong className="text-yellow-400">{i.quantity}x</strong> {i.name}</span>
                                          <span className="font-mono text-gray-400">{(i.price * i.quantity).toFixed(2)}€</span>
                                        </div>
                                      ))}
                                    </div>
                                    {o.notes && (
                                      <p className="text-[11px] text-amber-300 italic pt-1 border-t border-gray-800">
                                        📝 <strong>Notas:</strong> {o.notes}
                                      </p>
                                    )}
                                  </div>

                                  {/* Botón para Marcar Entregado */}
                                  <button
                                    onClick={() => updateOrderStatus(o.id, 'Entregado')}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 text-sm cursor-pointer"
                                  >
                                    <span>✅</span>
                                    <span>Marcar Entregado (+2.00€ a mi saldo)</span>
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* SECCIÓN 3: HISTORIAL DE ENTREGADAS */}
                        <div className="space-y-3 pt-4 border-t border-gray-800">
                          <h4 className="font-bold text-sm text-gray-300 border-b border-gray-800 pb-2 flex items-center gap-2">
                            <span>🟢</span> Mis Entregas Completadas ({myCompletedOrders.length}):
                          </h4>
                          {myCompletedOrders.length === 0 ? (
                            <p className="text-xs text-gray-500 text-center py-4">Aún no has completado entregas hoy.</p>
                          ) : (
                            myCompletedOrders.map(o => (
                              <div key={o.id} className="bg-[#181818] p-3 rounded-xl border border-emerald-800/40 text-xs space-y-1.5 opacity-90">
                                <div className="flex justify-between items-center">
                                  <span className="font-mono font-bold text-gray-300">{o.id} • {o.deliveredTimeStr || o.timeStr} ({o.dateStr})</span>
                                  <span className="bg-emerald-950 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-700 text-[10px] flex items-center gap-1">
                                    <span>✅ ENTREGADO</span>
                                    {o.isSettled && <span className="text-yellow-400"> (LIQUIDADO)</span>}
                                  </span>
                                </div>
                                <div className="flex justify-between text-gray-400 text-[11px] items-center">
                                  <span>👤 {o.clientName} ({o.phone})</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-emerald-400">+2.00€ Domicilio</span>
                                    <button
                                      onClick={() => sendCustomerDeliveredWhatsApp(o)}
                                      className="bg-[#25D366]/20 hover:bg-[#25D366] text-[#25D366] hover:text-white px-2 py-1 rounded-lg border border-[#25D366]/40 font-bold transition-all text-[10px] flex items-center gap-1"
                                      title="Notificar entrega al cliente por WhatsApp"
                                    >
                                      💬 Notificar Cliente
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 2: CRM DE CLIENTES */}
              {adminTab === 'crm' && (
                <div className="space-y-4">
                  <div className="bg-[#1e1e1e] p-4 rounded-2xl border border-gray-800 flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <h3 className="text-base font-black text-amber-400 flex items-center gap-2">
                        <span>👥</span> CRM Directorio de Clientes ({(() => {
                          const uniquePhones = new Set(ordersHistory.map(o => o.phone).filter(Boolean));
                          return uniquePhones.size;
                        })()})
                      </h3>
                      <p className="text-xs text-gray-400">Base de datos automatizada extraída en tiempo real de todos los pedidos.</p>
                    </div>
                  </div>

                  {(() => {
                    const clientMap = new Map();
                    ordersHistory.forEach(o => {
                      if (!o.phone) return;
                      const key = o.phone;
                      if (!clientMap.has(key)) {
                        clientMap.set(key, {
                          phone: o.phone,
                          name: o.clientName || 'Cliente',
                          address: o.address || '',
                          totalOrders: 0,
                          totalSpent: 0,
                          lastDate: o.dateStr || '',
                          itemsCount: {}
                        });
                      }
                      const c = clientMap.get(key);
                      c.totalOrders += 1;
                      c.totalSpent += (o.total || 0);
                      if (Array.isArray(o.items)) {
                        o.items.forEach(i => {
                          if (i.name) c.itemsCount[i.name] = (c.itemsCount[i.name] || 0) + (i.quantity || 1);
                        });
                      }
                    });

                    const clientList = Array.from(clientMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);

                    if (clientList.length === 0) {
                      return (
                        <div className="bg-[#181818] p-8 rounded-2xl border border-gray-800 text-center text-gray-500 text-xs">
                          Aún no hay clientes registrados en la base de datos CRM. Se poblará automáticamente al recibir pedidos.
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {clientList.map((client, idx) => {
                          const isVip = client.totalOrders >= 3 || client.totalSpent >= 40;
                          const isFrequent = client.totalOrders >= 2 && !isVip;
                          const favItem = Object.entries(client.itemsCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Hamburguesa Clásica';
                          const cleanPhone = client.phone.replace(/\s+/g, '').replace('+', '');

                          return (
                            <div key={idx} className="bg-[#181818] p-4 rounded-2xl border border-gray-800 space-y-2 hover:border-amber-500/40 transition-colors">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-black text-sm text-white flex items-center gap-2">
                                    <span>👤 {client.name}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                                      isVip 
                                        ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.5)]' 
                                        : (isFrequent ? 'bg-emerald-950 text-emerald-400 border border-emerald-700' : 'bg-gray-800 text-gray-400')
                                    }`}>
                                      {isVip ? '🌟 VIP' : (isFrequent ? '🛵 Frecuente' : '🆕 Nuevo')}
                                    </span>
                                  </h4>
                                  <span className="text-xs text-gray-400 font-mono">📱 {client.phone}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-black text-emerald-400 block">{client.totalSpent.toFixed(2)}€</span>
                                  <span className="text-[10px] text-gray-400">{client.totalOrders} pedido{client.totalOrders > 1 ? 's' : ''}</span>
                                </div>
                              </div>

                              <div className="text-xs text-gray-300 bg-black/40 p-2.5 rounded-xl border border-gray-800 space-y-1">
                                <p className="truncate">📍 <strong>Dirección:</strong> {client.address}</p>
                                <p className="text-amber-300 text-[11px]">🍔 <strong>Plato Favorito:</strong> {favItem}</p>
                              </div>

                              <div className="flex gap-2 pt-1">
                                <a
                                  href={`https://wa.me/${cleanPhone.startsWith('34') ? cleanPhone : '34' + cleanPhone}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-transform active:scale-95"
                                >
                                  <span>💬</span> Chat WhatsApp
                                </a>
                                <a
                                  href={`https://wa.me/${cleanPhone.startsWith('34') ? cleanPhone : '34' + cleanPhone}?text=${encodeURIComponent(`¡Hola ${client.name}! 🤠🔥 En Que Chimba Parce te premiamos por tu fidelidad. ¡Te regalamos las patatas en tu próximo pedido!`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-amber-500 hover:bg-amber-400 text-black font-black px-3 py-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-transform active:scale-95"
                                >
                                  🎁 Enviar Oferta
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 3: GESTIÓN DE INVENTARIO */}
              {adminTab === 'inventory' && (
                <div className="space-y-4">
                  <div className="bg-[#1e1e1e] p-4 rounded-2xl border border-gray-800 flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <h3 className="text-base font-black text-amber-400 flex items-center gap-2">
                        <span>📦</span> Control de Inventario & Insumos
                      </h3>
                      <p className="text-xs text-gray-400">Supervisa las existencias de carnes, panes, salsas y bebidas.</p>
                    </div>
                    <div className="flex gap-2 text-xs font-bold">
                      <span className="bg-emerald-950 text-emerald-400 border border-emerald-700 px-2.5 py-1 rounded-xl">
                        🟢 Stock Óptimo ({inventory.filter(i => i.stock > i.minStock).length})
                      </span>
                      <span className="bg-amber-950 text-amber-400 border border-amber-700 px-2.5 py-1 rounded-xl">
                        ⚠️ Stock Bajo ({inventory.filter(i => i.stock <= i.minStock && i.stock > 0).length})
                      </span>
                      <span className="bg-red-950 text-red-400 border border-red-700 px-2.5 py-1 rounded-xl">
                        🔴 Agotado ({inventory.filter(i => i.stock === 0).length})
                      </span>
                    </div>
                  </div>

                  {/* Formulario para agregar insumo nuevo */}
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!newInvItem.name) return alert('Ingresa el nombre del insumo');
                    const item = { ...newInvItem, id: 'inv_' + Date.now() };
                    saveInventory([...inventory, item]);
                    setNewInvItem({ name: '', category: 'Carnes', stock: 10, minStock: 5, unitCost: 1.00, unit: 'unidades' });
                  }} className="bg-[#181818] p-4 rounded-2xl border border-gray-800 grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                    <input
                      type="text"
                      placeholder="Nombre insumo..."
                      value={newInvItem.name}
                      onChange={e => setNewInvItem({ ...newInvItem, name: e.target.value })}
                      className="bg-black border border-gray-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-400 sm:col-span-2"
                    />
                    <select
                      value={newInvItem.category}
                      onChange={e => setNewInvItem({ ...newInvItem, category: e.target.value })}
                      className="bg-black border border-gray-700 rounded-xl px-3 py-2 text-white outline-none"
                    >
                      <option value="Carnes">🥩 Carnes</option>
                      <option value="Panes">🍞 Panes</option>
                      <option value="Bebidas">🥤 Bebidas</option>
                      <option value="Insumos">🍟 Insumos</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Stock inicial"
                      value={newInvItem.stock}
                      onChange={e => setNewInvItem({ ...newInvItem, stock: parseInt(e.target.value) || 0 })}
                      className="bg-black border border-gray-700 rounded-xl px-3 py-2 text-white outline-none"
                    />
                    <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-black font-black py-2 rounded-xl text-xs cursor-pointer shadow">
                      ➕ Agregar Insumo
                    </button>
                  </form>

                  {/* Lista de Insumos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {inventory.map(item => {
                      const isLow = item.stock <= item.minStock && item.stock > 0;
                      const isOut = item.stock === 0;

                      return (
                        <div key={item.id} className={`bg-[#181818] p-4 rounded-2xl border transition-all ${
                          isOut ? 'border-red-600/60 bg-red-950/10' : (isLow ? 'border-amber-500/60 bg-amber-950/10' : 'border-gray-800')
                        }`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">{item.category}</span>
                              <h4 className="font-black text-sm text-white">{item.name}</h4>
                            </div>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                              isOut ? 'bg-red-600 text-white border-red-400' : (isLow ? 'bg-amber-500 text-black border-amber-300' : 'bg-emerald-950 text-emerald-400 border-emerald-700')
                            }`}>
                              {isOut ? '🔴 AGOTADO' : (isLow ? '⚠️ STOCK BAJO' : '🟢 ÓPTIMO')}
                            </span>
                          </div>

                          <div className="flex justify-between items-center my-3 bg-black/50 p-2.5 rounded-xl border border-gray-800">
                            <span className="text-xs text-gray-400">Cantidad Actual:</span>
                            <span className="text-xl font-black text-white font-mono">{item.stock} <span className="text-xs text-gray-400 font-normal">{item.unit}</span></span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateStock(item.id, -5)}
                              className="bg-gray-800 hover:bg-gray-700 text-white font-black px-2.5 py-1.5 rounded-xl text-xs cursor-pointer active:scale-95"
                            >
                              -5
                            </button>
                            <button
                              type="button"
                              onClick={() => updateStock(item.id, -1)}
                              className="bg-gray-800 hover:bg-gray-700 text-white font-black px-3 py-1.5 rounded-xl text-xs cursor-pointer active:scale-95"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() => updateStock(item.id, 1)}
                              className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-black py-1.5 rounded-xl text-xs cursor-pointer active:scale-95 shadow"
                            >
                              +1 Stock
                            </button>
                            <button
                              type="button"
                              onClick={() => updateStock(item.id, 10)}
                              className="bg-emerald-700 hover:bg-emerald-600 text-white font-black px-2.5 py-1.5 rounded-xl text-xs cursor-pointer active:scale-95"
                            >
                              +10
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: CONTABILIDAD & REPORTES FINANCIEROS */}
              {adminTab === 'reports' && (
                <div className="space-y-6">
                  {(() => {
                    const todayStr = new Date().toLocaleDateString('es-ES');
                    let filtered = ordersHistory;
                    if (adminTimeFilter === 'today') filtered = ordersHistory.filter(o => o.dateStr === todayStr);
                    if (adminTimeFilter === 'specific') filtered = ordersHistory.filter(o => o.isoDateStr === selectedCustomDate);

                    const totalSales = filtered.reduce((s, o) => s + (o.total || 0), 0);
                    const totalCash = filtered.filter(o => o.paymentMethod === 'Efectivo').reduce((s, o) => s + (o.total || 0), 0);
                    const totalBizum = filtered.filter(o => o.paymentMethod === 'Bizum').reduce((s, o) => s + (o.total || 0), 0);
                    const totalDriverCost = filtered.filter(o => o.assignedDriver).length * 2.00;
                    const netProfit = totalSales - totalDriverCost;

                    return (
                      <div className="space-y-4">
                        <div className="bg-[#1e1e1e] p-4 rounded-2xl border border-gray-800 flex justify-between items-center flex-wrap gap-2">
                          <div>
                            <h3 className="text-base font-black text-amber-400 flex items-center gap-2">
                              <span>📊</span> Balance Contable & Reportes Financieros
                            </h3>
                            <p className="text-xs text-gray-400">Resumen detallado de ingresos, medios de pago y costos operativos.</p>
                          </div>
                          <button
                            onClick={exportToCSV}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow cursor-pointer transition-transform active:scale-95"
                          >
                            <span>📥</span> Exportar a Excel (CSV)
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-[#181818] p-4 rounded-2xl border border-gray-800">
                            <span className="text-xs text-gray-400 font-bold block mb-1">Ventas Totales</span>
                            <span className="text-2xl font-black text-amber-400 font-mono">{totalSales.toFixed(2)}€</span>
                            <span className="text-[10px] text-gray-500 block mt-1">{filtered.length} pedidos procesados</span>
                          </div>

                          <div className="bg-[#181818] p-4 rounded-2xl border border-gray-800">
                            <span className="text-xs text-emerald-400 font-bold block mb-1">Efectivo Recibido</span>
                            <span className="text-2xl font-black text-emerald-400 font-mono">{totalCash.toFixed(2)}€</span>
                            <span className="text-[10px] text-gray-500 block mt-1">{filtered.filter(o => o.paymentMethod === 'Efectivo').length} pedidos en metálico</span>
                          </div>

                          <div className="bg-[#181818] p-4 rounded-2xl border border-gray-800">
                            <span className="text-xs text-blue-400 font-bold block mb-1">Cobrado por Bizum</span>
                            <span className="text-2xl font-black text-blue-400 font-mono">{totalBizum.toFixed(2)}€</span>
                            <span className="text-[10px] text-gray-500 block mt-1">{filtered.filter(o => o.paymentMethod === 'Bizum').length} pedidos por transferencia</span>
                          </div>

                          <div className="bg-[#181818] p-4 rounded-2xl border border-gray-800">
                            <span className="text-xs text-purple-400 font-bold block mb-1">Ganancia Estimada</span>
                            <span className="text-2xl font-black text-purple-400 font-mono">{netProfit.toFixed(2)}€</span>
                            <span className="text-[10px] text-gray-500 block mt-1">Deduciendo {totalDriverCost.toFixed(2)}€ envíos</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Interactivo de Desglose de Domicilios (Por Liquidar / Liquidados) */}
      <AnimatePresence>
        {payoutDetailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setPayoutDetailModal(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md pointer-events-auto"
            />

            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#141414] w-full max-w-lg rounded-3xl p-6 relative z-10 border border-gray-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] max-h-[90vh] flex flex-col pointer-events-auto"
            >
              {(() => {
                const isPending = payoutDetailModal.filterType === 'pending';
                const filteredOrders = ordersHistory.filter(o => 
                  o.assignedDriver === payoutDetailModal.driverName && 
                  o.status === 'Entregado' && 
                  (isPending ? !o.isSettled : o.isSettled)
                );

                const totalSum = filteredOrders.length * deliveryFee;

                return (
                  <>
                    <div className="flex justify-between items-center pb-4 border-b border-gray-800 mb-4">
                      <div>
                        <span className="text-xs text-gray-400 font-bold block">Desglose de Envíos:</span>
                        <h3 className="text-lg font-black text-white flex items-center gap-2">
                          <span>🛵 {payoutDetailModal.driverName}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${isPending ? 'bg-amber-950 text-amber-400 border-amber-700' : 'bg-emerald-950 text-emerald-400 border-emerald-700'}`}>
                            {isPending ? 'Por Liquidar (Pendiente)' : 'Liquidados (Pagados)'}
                          </span>
                        </h3>
                      </div>
                      <button onClick={() => setPayoutDetailModal(null)} className="text-gray-400 hover:text-white bg-gray-800 w-8 h-8 rounded-full flex items-center justify-center font-bold">✕</button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                      <div className="bg-[#1e1e1e] p-3 rounded-xl border border-gray-800 flex justify-between items-center">
                        <span className="text-xs text-gray-400 font-bold">Total Domicilios ({filteredOrders.length}):</span>
                        <span className="text-xl font-black text-[var(--color-brand-yellow)]">{totalSum.toFixed(2)}€</span>
                      </div>

                      {filteredOrders.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-8">No hay domicilios en este estado.</p>
                      ) : (
                        filteredOrders.map(o => (
                          <div key={o.id} className="bg-[#181818] p-3 rounded-xl border border-gray-800 text-xs space-y-1.5">
                            <div className="flex justify-between font-mono font-bold text-orange-400">
                              <span>{o.id} • {o.dateStr} ({o.deliveredTimeStr || o.timeStr})</span>
                              <span className="text-emerald-400 font-black">+2.00€</span>
                            </div>
                            <div className="text-gray-300 font-medium">👤 Cliente: {o.clientName} ({o.phone})</div>
                            <div className="text-gray-400 truncate">📍 {o.address}</div>
                            {o.settledDate && (
                              <div className="text-[10px] text-yellow-400/80 italic pt-1 border-t border-gray-800">
                                Pagado el: {o.settledDate}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Acciones del Modal */}
                    <div className="pt-4 border-t border-gray-800 flex gap-2">
                      <button 
                        onClick={() => {
                          setPrintableTicket({
                            driverName: payoutDetailModal.driverName,
                            orders: filteredOrders,
                            totalAmount: totalSum,
                            titleType: isPending ? 'PENDIENTE DE PAGO' : 'PAGADO Y LIQUIDADO',
                            dateStr: new Date().toLocaleDateString('es-ES') + ' ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                          });
                        }}
                        className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow"
                      >
                        <span>🖨️</span> Generar Ticket con Logo
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ticket de Liquidación Imprimible (POS / Recibo con Logo) */}
      {/* Modal de Ticket Imprimible (Individual de Cliente o Liquidación de Repartidor) */}
      <AnimatePresence>
        {printableTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white text-black w-full max-w-sm rounded-2xl p-6 relative shadow-2xl max-h-[90vh] flex flex-col font-mono"
            >
              {/* Botón Cerrar */}
              <button 
                onClick={() => setPrintableTicket(null)} 
                className="absolute top-3 right-3 text-gray-600 hover:text-black bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center font-bold no-print cursor-pointer"
              >
                ✕
              </button>

              {/* Área del Ticket */}
              <div className="flex-1 overflow-y-auto pr-1 text-center space-y-3 text-xs">
                {/* Logo de Que Chimba Parce */}
                <img src="/logo.png" alt="Que Chimba Parce Logo" className="w-24 h-24 mx-auto object-contain" />
                
                <h2 className="font-black text-base uppercase tracking-wider">PARCE QUE CHIMBA</h2>
                <p className="text-[11px] text-gray-700">Comida Rápida Colombiana 🇨🇴🇪🇸</p>
                <div className="border-b-2 border-dashed border-gray-400 my-2"></div>

                {/* SI ES UN TICKET DE PEDIDO INDIVIDUAL DE CLIENTE */}
                {printableTicket.id && !printableTicket.orders ? (
                  <>
                    <div className="font-bold text-sm bg-gray-100 p-2 rounded">
                      TICKET DE PEDIDO DE CLIENTE
                      <span className="block text-[11px] font-black text-amber-600">{printableTicket.id}</span>
                    </div>

                    <div className="text-left space-y-1.5 text-[11px]">
                      <p><strong>Cliente:</strong> {printableTicket.clientName}</p>
                      <p><strong>Teléfono:</strong> {printableTicket.phone}</p>
                      <p><strong>Dirección:</strong> {formatOrderAddressAndMaps(printableTicket.address).text}</p>
                      <p><strong>Método de Pago:</strong> {printableTicket.paymentMethod}</p>
                      <p><strong>Fecha/Hora:</strong> {printableTicket.dateStr} ({printableTicket.timeStr || ''})</p>
                    </div>

                    <div className="border-b border-dashed border-gray-400 my-2"></div>

                    {/* Detalle de Platos */}
                    <div className="space-y-1.5 text-left text-[11px]">
                      <div className="flex justify-between font-bold border-b border-gray-300 pb-1">
                        <span>CANT x PRODUCTO</span>
                        <span>PRECIO</span>
                      </div>
                      {(Array.isArray(printableTicket.items) ? printableTicket.items : []).map((i, idx) => {
                        const qty = i.quantity || 1;
                        const price = i.price || 0;
                        return (
                          <div key={idx} className="space-y-0.5">
                            <div className="flex justify-between font-bold">
                              <span>{qty}x {i.name}</span>
                              <span>{(price * qty).toFixed(2)}€</span>
                            </div>
                            {i.desc && <div className="text-[10px] text-gray-500 italic pl-3">└ {i.desc}</div>}
                          </div>
                        );
                      })}
                    </div>

                    {printableTicket.notes && (
                      <div className="text-left text-[11px] bg-amber-50 p-2 rounded border border-amber-200 mt-2">
                        📝 <strong>Notas:</strong> {printableTicket.notes}
                      </div>
                    )}

                    <div className="border-b-2 border-dashed border-gray-400 my-2"></div>

                    {/* Desglose de Totales */}
                    <div className="text-left text-[11px] space-y-1">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal Comida:</span>
                        <span>{(printableTicket.subtotal || (printableTicket.total - (printableTicket.deliveryFee || 2.0))).toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Envío a Domicilio:</span>
                        <span>+{(printableTicket.deliveryFee || 2.0).toFixed(2)}€</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-sm font-black p-2 bg-gray-100 rounded mt-2">
                      <span>TOTAL A PAGAR:</span>
                      <span className="text-base text-emerald-700">{(printableTicket.total || 0).toFixed(2)}€</span>
                    </div>
                  </>
                ) : (
                  /* TICKET DE LIQUIDACIÓN DE REPARTIDOR */
                  <>
                    <div className="font-bold text-sm bg-gray-100 p-2 rounded">
                      TICKET DE LIQUIDACIÓN REPARTIDOR
                      <span className="block text-[10px] font-normal text-gray-600">[{printableTicket.titleType || 'Liquidación'}]</span>
                    </div>

                    <div className="text-left space-y-1 text-[11px]">
                      <p><strong>Repartidor:</strong> {printableTicket.driverName}</p>
                      <p><strong>Fecha Emisión:</strong> {printableTicket.dateStr}</p>
                      <p><strong>Total Envíos:</strong> {(printableTicket.orders || []).length}</p>
                    </div>

                    <div className="border-b border-dashed border-gray-400 my-2"></div>

                    {/* Tabla de Envíos */}
                    <div className="space-y-1.5 text-left text-[10px]">
                      <div className="flex justify-between font-bold border-b border-gray-300 pb-1">
                        <span>PEDIDO / FECHA</span>
                        <span>DOMICILIO</span>
                      </div>
                      {(printableTicket.orders || []).map(o => (
                        <div key={o.id} className="flex justify-between">
                          <span>{o.id} ({o.timeStr})</span>
                          <span>2.00€</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-b-2 border-dashed border-gray-400 my-2"></div>

                    {/* Total Final */}
                    <div className="flex justify-between items-center text-sm font-black p-2 bg-gray-100 rounded">
                      <span>TOTAL A PAGAR:</span>
                      <span className="text-base text-emerald-700">{(printableTicket.totalAmount || 0).toFixed(2)}€</span>
                    </div>

                    {/* Firmas */}
                    <div className="pt-6 grid grid-cols-2 gap-4 text-[9px] text-gray-600">
                      <div className="border-t border-gray-400 pt-1">
                        Firma Dueño
                      </div>
                      <div className="border-t border-gray-400 pt-1">
                        Firma Repartidor
                      </div>
                    </div>

                    <p className="text-[9px] text-gray-500 pt-2">¡Gracias por tu excelente trabajo!</p>
                  </>
                )}
              </div>

              {/* Botones Imprimir / Cerrar */}
              <div className="pt-4 border-t border-gray-200 flex gap-2 no-print">
                <button 
                  onClick={() => window.print()}
                  className="flex-1 bg-black text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1 shadow hover:bg-gray-800 cursor-pointer"
                >
                  <span>🖨️</span> Imprimir Ticket
                </button>
                <button 
                  onClick={() => setPrintableTicket(null)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Flotante de Confirmación de Pedido Recibido en la App (Sin obligar a abrir WhatsApp) */}
      <AnimatePresence>
        {submittedOrderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-[#141414] border-2 border-[var(--color-brand-orange)] text-white w-full max-w-md rounded-3xl p-6 relative shadow-[0_0_50px_rgba(255,107,0,0.4)] text-center space-y-4 font-sans"
            >
              <div className="w-20 h-20 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-full flex items-center justify-center mx-auto text-4xl shadow-lg animate-bounce">
                📲
              </div>

              <h3 className="text-xl font-black text-[var(--color-brand-yellow)] uppercase tracking-wide">
                📲 ¡ÚLTIMO PASO: ENVIAR POR WHATSAPP!
              </h3>

              <div className="bg-black/60 p-3 rounded-2xl border border-gray-800 space-y-1">
                <span className="text-xs text-gray-400 font-bold block">Número de Pedido:</span>
                <span className="font-mono text-2xl font-black text-amber-400">{submittedOrderModal.id}</span>
              </div>

              <div className="text-xs text-gray-300 bg-[#1e1e1e] p-4 rounded-2xl border border-gray-800 text-left space-y-2">
                <div className="flex justify-between items-center border-b border-gray-800 pb-1.5 font-bold">
                  <span>👤 Cliente: {submittedOrderModal.clientName}</span>
                  <span className="text-amber-400 font-black">{submittedOrderModal.total.toFixed(2)}€ ({submittedOrderModal.paymentMethod})</span>
                </div>
                <p className="text-gray-300">📍 <strong>Entrega:</strong> {submittedOrderModal.address}</p>
                <p className="text-gray-300">📱 <strong>Teléfono:</strong> {submittedOrderModal.phone}</p>
                
                <div className="pt-2 border-t border-gray-800/80 space-y-1">
                  <span className="text-[11px] text-yellow-400 font-bold uppercase block">🍔 Comida Solicitada:</span>
                  {(Array.isArray(submittedOrderModal.items) ? submittedOrderModal.items : []).map((i, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span>{i.quantity || 1}x {i.name}</span>
                      <span className="font-mono text-gray-400">{((i.price || 0) * (i.quantity || 1)).toFixed(2)}€</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-r from-red-950/95 to-amber-950/95 border-2 border-red-500 p-4 rounded-2xl text-red-100 text-xs font-semibold space-y-2 text-left shadow-[0_0_35px_rgba(239,68,68,0.4)]">
                <p className="font-black text-amber-400 text-sm flex items-center gap-1.5 uppercase tracking-wide">
                  <span>🤠</span> ¡OJO PUES PARCE! TU PEDIDO AÚN NO HA LLEGADO
                </p>
                <p className="text-[12px] leading-relaxed text-amber-100 font-medium">
                  ¡Ave María pues! Para que la doña reciba tu boleto y los muchachos en la cocina empiecen a fritar esa delicia, <strong>DEBES tocar el botón verde de abajo para enviar tu mensaje al WhatsApp (+34 603 95 95 37)</strong>. ¡Sin ese mensaje de WhatsApp el restaurante NO sabe qué cocinarte mijo! 🍔🌭
                </p>
              </div>

              <div className="flex flex-col gap-2.5 pt-1">
                <a
                  href={`https://wa.me/34603959537?text=${encodeURIComponent(
                    `*¡Hola! Quiero hacer un pedido en Parce Que Chimba*\n\n` +
                    `*Mis Datos:*\n` +
                    `👤 Nombre: ${submittedOrderModal.clientName}\n` +
                    `🏠 Dirección: ${submittedOrderModal.address}\n` +
                    `📱 Teléfono: ${submittedOrderModal.phone}\n` +
                    `💳 Método de Pago: ${submittedOrderModal.paymentMethod}\n` +
                    `${submittedOrderModal.notes ? `📝 Notas: ${submittedOrderModal.notes}\n` : ''}\n` +
                    `*Mi Pedido (${submittedOrderModal.id}):*\n` +
                    (Array.isArray(submittedOrderModal.items) ? submittedOrderModal.items : []).map(i => `${i.quantity || 1}x ${i.name} (${((i.price || 0) * (i.quantity || 1)).toFixed(2)}€)`).join('\n') +
                    `\n\n*Subtotal:* ${submittedOrderModal.subtotal.toFixed(2)}€\n` +
                    `*🛵 Domicilio:* ${submittedOrderModal.deliveryFee.toFixed(2)}€\n` +
                    `*Total a pagar: ${submittedOrderModal.total.toFixed(2)}€*`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-black py-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.5)] cursor-pointer transition-transform active:scale-95 border-2 border-emerald-300 animate-pulse text-center"
                >
                  <span>💬</span>
                  <span className="text-sm font-black">📲 ¡OJO PUES! TOCA AQUÍ Y ENVÍA TU PEDIDO A WHATSAPP</span>
                </a>

                <button
                  type="button"
                  onClick={() => setSubmittedOrderModal(null)}
                  className="w-full bg-gradient-to-r from-[var(--color-brand-orange)] to-[var(--color-brand-yellow)] text-black font-black py-3 rounded-2xl text-xs shadow-xl cursor-pointer hover:scale-[1.02] transition-transform"
                >
                  🛍️ Volver al Menú Principal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PWA Install Guide Modal */}
      <AnimatePresence>
        {showInstallGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowInstallGuide(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md pointer-events-auto"
            />

            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#141414] w-full max-w-sm rounded-3xl p-6 relative z-10 border border-orange-500/40 shadow-[0_0_50px_rgba(255,107,0,0.4)] text-center space-y-4 pointer-events-auto"
            >
              <div className="w-16 h-16 bg-gradient-to-tr from-orange-500 to-yellow-400 rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-lg animate-bounce">
                📲
              </div>
              <h3 className="text-xl font-black text-white">Instalar en Pantalla de Inicio</h3>
              
              <div className="bg-black/60 p-4 rounded-2xl border border-gray-800 text-left text-xs space-y-3.5 text-gray-300">
                <div>
                  <p className="font-black text-yellow-400 text-sm flex items-center gap-1.5 mb-1">
                    <span>📱</span> iPhone (Safari o Google Chrome):
                  </p>
                  <p className="text-[11px] text-gray-400 mb-2">En iPhone, Apple permite agregar el icono en 2 toques:</p>
                  <ol className="space-y-1.5 text-gray-200 font-medium">
                    <li className="flex items-center gap-2 bg-[#1e1e1e] p-2 rounded-xl border border-gray-800">
                      <span className="bg-amber-500 text-black w-5 h-5 rounded-full font-black text-[11px] flex items-center justify-center flex-shrink-0">1</span>
                      <span>Toca el botón <strong>Compartir 📤</strong> (abajo en Safari o arriba en Chrome).</span>
                    </li>
                    <li className="flex items-center gap-2 bg-[#1e1e1e] p-2 rounded-xl border border-gray-800">
                      <span className="bg-amber-500 text-black w-5 h-5 rounded-full font-black text-[11px] flex items-center justify-center flex-shrink-0">2</span>
                      <span>Baja y selecciona <strong>"Agregar a inicio" ➕</strong></span>
                    </li>
                  </ol>
                </div>

                <div className="pt-3 border-t border-gray-800">
                  <p className="font-black text-orange-400 text-sm flex items-center gap-1.5 mb-1">
                    <span>🤖</span> Android (Google Chrome):
                  </p>
                  <ol className="space-y-1 text-gray-300 text-[11px]">
                    <li>Toca los 3 puntos <strong>⋮</strong> arriba a la derecha ➔ <strong>"Instalar Aplicación"</strong>.</li>
                  </ol>
                </div>
              </div>

              <a 
                href="/que-chimba-parce.apk"
                download="Que-Chimba-Parce.apk"
                onClick={() => setShowInstallGuide(false)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-xl shadow-lg text-sm flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] transition-transform text-center block"
              >
                <span>⬇️</span> Descargar App Directa (APK 2.7 MB)
              </a>

              <button 
                onClick={() => setShowInstallGuide(false)}
                className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2.5 rounded-xl text-xs cursor-pointer transition-colors"
              >
                Cerrar Guía
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Selección de Sabores de Bebidas / Jugos */}
      <AnimatePresence>
        {flavorModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setFlavorModalItem(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md pointer-events-auto"
            />

            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#141414] w-full max-w-sm rounded-3xl p-6 relative z-10 border border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.3)] text-center space-y-4 pointer-events-auto"
            >
              <div className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-lg">
                🥤
              </div>

              <h3 className="text-lg font-black text-white">{flavorModalItem.title}</h3>
              <p className="text-xs text-gray-400 font-medium">{flavorModalItem.item.name} - <strong className="text-amber-400">{flavorModalItem.item.price.toFixed(2)}€</strong></p>

              <div className="grid grid-cols-2 gap-2 pt-2">
                {flavorModalItem.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => addToCart(flavorModalItem.item, opt)}
                    className="bg-[#1e1e1e] hover:bg-gradient-to-r hover:from-amber-500 hover:to-orange-500 text-gray-200 hover:text-black border border-gray-700 hover:border-yellow-400 py-3 px-2 rounded-xl font-black text-xs transition-all shadow cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>✨</span> {opt}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setFlavorModalItem(null)}
                className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-xl font-bold text-xs mt-2 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Aviso: Negocio Cerrado */}
      <AnimatePresence>
        {showClosedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowClosedModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md pointer-events-auto"
            />

            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#141414] w-full max-w-sm rounded-3xl p-6 relative z-10 border border-red-500/40 shadow-[0_0_50px_rgba(239,68,68,0.3)] text-center space-y-4 pointer-events-auto"
            >
              <div className="w-16 h-16 bg-red-950/80 border border-red-700/60 rounded-2xl mx-auto flex items-center justify-center text-3xl shadow-lg">
                🔴
              </div>

              <h3 className="text-xl font-black text-white">Local Cerrado Temporalmente</h3>
              
              <div className="bg-black/60 p-4 rounded-2xl border border-gray-800 text-xs space-y-2 text-gray-300">
                <p className="font-bold text-yellow-400 text-sm">¡Hola Parce! 👋</p>
                <p>En este momento la cocina de <strong>Que Chimba Parce</strong> está cerrada recibiendo insumos frescos.</p>
                
                <div className="pt-2 border-t border-gray-800 text-[11px] text-gray-400 space-y-1">
                  <p className="font-bold text-orange-400 text-xs">🕒 Horarios Oficiales de Atención:</p>
                  <p className="text-gray-200">🗓️ <strong>Martes a Jueves:</strong> 17:00 hs – 00:00 hs (5:00 PM - 12:00 AM)</p>
                  <p className="text-gray-200">🔥 <strong>Viernes a Domingo:</strong> 17:00 hs – 03:00 hs (5:00 PM - 3:00 AM)</p>
                  <p className="text-gray-400 text-[10px]">🚫 <strong>Lunes:</strong> Cerrado por descanso</p>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 italic">¡Te esperamos muy pronto con todo el sabor colombiano! 🇨🇴🍔</p>

              <button 
                onClick={() => setShowClosedModal(false)}
                className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl text-xs"
              >
                Cerrar Aviso
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Código QR & Volante Promocional para Imprimir */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#141414] text-white w-full max-w-sm rounded-3xl p-6 relative z-10 border border-orange-500/40 shadow-[0_0_50px_rgba(255,107,0,0.4)] text-center space-y-4 pointer-events-auto"
            >
              <button 
                onClick={() => setShowQrModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white bg-gray-800 w-8 h-8 rounded-full flex items-center justify-center font-bold no-print"
              >
                ✕
              </button>

              <div className="bg-white text-black p-5 rounded-2xl shadow-2xl space-y-3 font-sans">
                <img src="/logo.png" alt="Que Chimba Parce Logo" className="w-20 h-20 mx-auto object-contain" />
                <h3 className="font-black text-xl uppercase tracking-wider text-[#FF6B00]">PARCE QUE CHIMBA</h3>
                <p className="text-xs font-bold text-gray-700">Comida Rápida Colombiana 🇨🇴🇪🇸</p>

                <div className="p-3 bg-gray-100 rounded-2xl border border-gray-200 inline-block shadow-inner">
                  <img 
                    src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=https://parcequechimba.com" 
                    alt="Código QR Que Chimba Parce" 
                    className="w-48 h-48 mx-auto rounded-lg"
                  />
                </div>

                <p className="text-xs font-black text-gray-800 px-2">
                  📱 ¡Escanea con la cámara de tu celular para ver la carta y pedir en 1 clic!
                </p>

                <div className="bg-[#FF6B00] text-white font-black py-2.5 px-4 rounded-xl text-sm tracking-wide shadow">
                  🌐 parcequechimba.com
                </div>

                <p className="text-[11px] text-gray-600 font-bold pt-1">
                  📞 WhatsApp Pedidos: +34 603 95 95 37
                </p>
              </div>

              <button 
                onClick={() => window.print()}
                className="w-full bg-gradient-to-r from-[var(--color-brand-orange)] to-[var(--color-brand-yellow)] text-black font-black py-3.5 rounded-xl shadow-lg text-sm flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] transition-transform"
              >
                <span>🖨️</span> Imprimir Volante / Guardar PDF
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Botón Flotante del Asistente Virtual AI (Esquina Inferior Izquierda) */}
      <div className="fixed bottom-6 left-6 z-40">
        <button
          onClick={() => setIsChatOpen(true)}
          className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black border-2 border-amber-300 px-4 py-2.5 rounded-full font-black shadow-[0_0_25px_rgba(245,158,11,0.6)] flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
        >
          <span className="text-lg animate-bounce">🤖</span>
          <span className="text-xs font-black uppercase tracking-wider">Asistente IA</span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
        </button>
      </div>

      {/* Modal Ventana Chatbot AI */}
      {isChatOpen && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-2 sm:p-4">
          <div 
            onClick={() => setIsChatOpen(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <div className="bg-[#141414] w-full max-w-md rounded-3xl relative z-10 border border-amber-500/40 shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col h-[520px] max-h-[85vh] overflow-hidden">
            {/* Header Chat */}
            <div className="bg-gradient-to-r from-[var(--color-brand-darker)] to-[#1e1e1e] p-4 border-b border-gray-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-xl shadow-md border border-amber-300">
                  🤖
                </div>
                <div>
                  <h3 className="font-black text-sm text-amber-300 flex items-center gap-1.5">
                    <span>ParceBot AI</span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700 font-bold">
                      Online 🟢
                    </span>
                  </h3>
                  <span className="text-[10px] text-gray-400 font-semibold block">Asistente Oficial • Que Chimba Parce</span>
                </div>
              </div>

              <button 
                onClick={() => setIsChatOpen(false)}
                className="text-gray-400 hover:text-white bg-gray-800 w-8 h-8 rounded-full flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Alerta de Estado del Negocio en el Chat */}
            {!isBusinessOpen && (
              <div className="bg-red-950/90 border-b border-red-800/60 p-2.5 text-center text-xs text-red-300 font-bold flex items-center justify-center gap-1.5 shrink-0">
                <span>🌙</span> Local Cerrado actualmente • Solo información de menú
              </div>
            )}

            {/* Mensajes Chat */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-black/40">
              {chatMessages.map(msg => (
                <div 
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs shadow-md ${
                    msg.sender === 'user' 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black font-semibold rounded-br-none'
                      : 'bg-[#1e1e1e] text-gray-200 border border-gray-800 rounded-bl-none whitespace-pre-line leading-relaxed'
                  }`}>
                    <p>{msg.text}</p>
                    <span className={`text-[9px] block mt-1 text-right ${msg.sender === 'user' ? 'text-black/70' : 'text-gray-500'}`}>
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-[#1e1e1e] border border-gray-800 px-4 py-2.5 rounded-2xl text-xs text-amber-400 font-bold flex items-center gap-1.5 animate-pulse">
                    <span>🤖 ParceBot está escribiendo</span>
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce delay-100">.</span>
                    <span className="animate-bounce delay-200">.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Sugerencias Rápidas */}
            <div className="p-2 bg-[#1a1a1a] border-t border-gray-800 flex gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
              <button 
                onClick={() => handleSendChatMessage('¿Tienen Perros Calientes Colombianos?')}
                className="text-[10px] bg-black/60 hover:bg-black text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full whitespace-nowrap font-bold shrink-0 cursor-pointer"
              >
                🌭 Perros Colombianos
              </button>
              <button 
                onClick={() => handleSendChatMessage('¿Cuáles son las Hamburguesas?')}
                className="text-[10px] bg-black/60 hover:bg-black text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full whitespace-nowrap font-bold shrink-0 cursor-pointer"
              >
                🍔 Hamburguesas
              </button>
              <button 
                onClick={() => handleSendChatMessage('¿Cuáles son los horarios de atención?')}
                className="text-[10px] bg-black/60 hover:bg-black text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full whitespace-nowrap font-bold shrink-0 cursor-pointer"
              >
                🕒 Horarios
              </button>
              <button 
                onClick={() => handleSendChatMessage('¿Cuánto cuesta el domicilio?')}
                className="text-[10px] bg-black/60 hover:bg-black text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full whitespace-nowrap font-bold shrink-0 cursor-pointer"
              >
                🛵 Domicilio
              </button>
            </div>

            {/* Input de Chat con Botón de Voz 🎙️ */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChatMessage();
              }}
              className="p-3 bg-[#141414] border-t border-gray-800 flex gap-2 shrink-0 items-center"
            >
              <button
                type="button"
                onClick={handleVoiceInput}
                className={`p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center transition-all cursor-pointer ${
                  isListening 
                    ? 'bg-red-600 text-white animate-pulse border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.6)]' 
                    : 'bg-gray-800 hover:bg-gray-700 text-amber-300 border-gray-700'
                }`}
                title="Hablar por voz a ParceBot"
              >
                <span>{isListening ? '🎙️ Escuchando...' : '🎙️ Voz'}</span>
              </button>

              <input 
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder={isListening ? "Escuchando tu voz..." : "Escribe o habla a ParceBot..."}
                className="flex-1 bg-black text-white text-xs border border-gray-700 rounded-xl px-3.5 py-2.5 outline-none focus:border-amber-400"
              />

              <button 
                type="submit"
                disabled={!chatInput.trim()}
                className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center cursor-pointer shadow"
              >
                <span>Enviar 🚀</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
