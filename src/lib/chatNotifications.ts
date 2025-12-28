/**
 * ═══════════════════════════════════════════════════════
 * GESTÃO DE VALIDADES - NOTIFICAÇÕES DO CHAT
 * Push notifications e sons para o chat
 * ═══════════════════════════════════════════════════════
 */

// ═══ ESTADO ═══
let audioContext: AudioContext | null = null;
let lastReadGlobalTimestamp: string | null = null;

// ═══ CONFIGURAÇÕES ═══
export interface ChatNotificationSettings {
  pushEnabled: boolean;
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: ChatNotificationSettings = {
  pushEnabled: true,
  soundEnabled: true,
};

export const getChatNotificationSettings = (): ChatNotificationSettings => {
  try {
    const stored = localStorage.getItem('chat_notification_settings');
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveChatNotificationSettings = (settings: Partial<ChatNotificationSettings>): void => {
  const current = getChatNotificationSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem('chat_notification_settings', JSON.stringify(updated));
};

// ═══ ÚLTIMO TIMESTAMP LIDO (GLOBAL CHAT) ═══
export const getLastReadGlobalTimestamp = (): string | null => {
  if (lastReadGlobalTimestamp) return lastReadGlobalTimestamp;
  return localStorage.getItem('chat_last_read_global');
};

export const setLastReadGlobalTimestamp = (timestamp: string): void => {
  lastReadGlobalTimestamp = timestamp;
  localStorage.setItem('chat_last_read_global', timestamp);
};

// ═══ NOTIFICAÇÃO PUSH ═══
export const sendChatNotification = (userName: string, message: string): void => {
  const settings = getChatNotificationSettings();
  if (!settings.pushEnabled) return;
  
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const notification = new Notification(`💬 ${userName}`, {
      body: message.length > 100 ? message.substring(0, 100) + '...' : message,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'chat-message',
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      // Navegar para o chat
      if (window.location.pathname !== '/chat') {
        window.location.href = '/chat';
      }
    };

    // Auto-fechar após 5s
    setTimeout(() => notification.close(), 5000);
  } catch (err) {
    console.error('Erro ao enviar notificação de chat:', err);
  }
};

// ═══ SOM DE NOTIFICAÇÃO ═══
export const playNotificationSound = (): void => {
  const settings = getChatNotificationSettings();
  if (!settings.soundEnabled) return;

  try {
    // Criar AudioContext se não existir
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }

    // Som de notificação simples (beep)
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 880; // A5
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (err) {
    console.error('Erro ao tocar som:', err);
  }
};

// ═══ SOM DE MENSAGEM (durante conversa) ═══
export const playMessageSound = (): void => {
  const settings = getChatNotificationSettings();
  if (!settings.soundEnabled) return;

  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }

    // Som mais suave para mensagens durante conversa
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 660; // E5
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch (err) {
    console.error('Erro ao tocar som de mensagem:', err);
  }
};

// ═══ VERIFICAR E NOTIFICAR ═══
export const notifyNewMessage = (
  userName: string, 
  message: string, 
  isChatOpen: boolean = false,
  isOwnMessage: boolean = false
): void => {
  // Não notificar mensagens próprias
  if (isOwnMessage) return;

  if (isChatOpen) {
    // Chat aberto - só toca som
    playMessageSound();
  } else {
    // Chat fechado - push + som
    sendChatNotification(userName, message);
    playNotificationSound();
  }
};

// ═══ SOLICITAR PERMISSÃO ═══
export const requestChatNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  
  if (Notification.permission === 'granted') return true;
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};
