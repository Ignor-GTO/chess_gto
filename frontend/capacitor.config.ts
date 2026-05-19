import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Уникальный ID приложения
  appId: 'uz.gtoteam.chess',
  appName: 'Chess GTO',
  webDir: 'dist',

  // Сервер (для разработки — локальный)
  server: {
    androidScheme: 'https',
    // В продакшне убрать url и использовать bundled assets
    // url: 'https://chess.gto-team.uz',
    cleartext: false,
  },

  // iOS настройки
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0f0f1a',
    // Разрешаем нативный TTS
    allowsInlineMediaPlayback: true,
  },

  // Android настройки
  android: {
    backgroundColor: '#0f0f1a',
    // Разрешаем WebSockets в фоне
    allowMixedContent: false,
  },

  // Плагины
  plugins: {
    // Текст в речь (TTS) — нативный движок, офлайн
    TextToSpeech: {
      // iOS: использовать системный голос
      // Android: использовать Google TTS или системный
    },

    // Статус-бар (мобильный дизайн)
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0f0f1a',
    },

    // Splashscreen
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f0f1a',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
