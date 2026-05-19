/**
 * useTTS.js — Composable для Text-to-Speech
 *
 * На мобильном (Capacitor): использует нативный TTS плагин
 * На вебе (браузер): использует Web Speech API
 *
 * Установка плагина:
 *   npm install @capacitor-community/text-to-speech
 *   npx cap sync
 */
import { ref } from 'vue';
import { Capacitor } from '@capacitor/core';

// Динамический импорт Capacitor TTS (только на мобильном)
let TextToSpeech = null;

async function loadCapacitorTTS() {
  if (Capacitor.isNativePlatform() && !TextToSpeech) {
    const mod = await import('@capacitor-community/text-to-speech');
    TextToSpeech = mod.TextToSpeech;
  }
}

export function useTTS() {
  const isSpeaking = ref(false);

  /**
   * Произнести текст через нативный TTS (офлайн).
   *
   * @param {string} text - Текст для озвучки
   * @param {object} options - { lang, rate, pitch, volume }
   */
  async function speak(text, options = {}) {
    if (isSpeaking.value) {
      await stop();
    }

    const lang = options.lang || 'ru-RU';
    const rate = options.rate || 1.0;
    const pitch = options.pitch || 1.0;
    const volume = options.volume || 1.0;

    isSpeaking.value = true;

    try {
      if (Capacitor.isNativePlatform()) {
        // ─── Нативный TTS (iOS/Android) — полностью офлайн ───────────────
        await loadCapacitorTTS();
        await TextToSpeech.speak({
          text,
          lang,
          rate,
          pitch,
          volume,
          category: 'ambient', // iOS: не прерывать музыку
        });
      } else {
        // ─── Web Speech API (браузер) ─────────────────────────────────────
        await speakWeb(text, { lang, rate, pitch, volume });
      }
    } catch (err) {
      console.error('TTS ошибка:', err);
    } finally {
      isSpeaking.value = false;
    }
  }

  /**
   * Остановить озвучку.
   */
  async function stop() {
    isSpeaking.value = false;
    if (Capacitor.isNativePlatform() && TextToSpeech) {
      await TextToSpeech.stop();
    } else {
      window.speechSynthesis?.cancel();
    }
  }

  return { speak, stop, isSpeaking };
}

// ─── Web Speech API (для браузерной версии) ──────────────────────────────────

function speakWeb(text, { lang, rate, pitch, volume }) {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('Web Speech API не поддерживается'));
      return;
    }

    const run = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find(v => v.lang === lang) ||
        voices.find(v => v.lang.startsWith(lang.split('-')[0]));
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onend = resolve;
      utterance.onerror = resolve;

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      run();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        run();
      };
      setTimeout(run, 250);
    }
  });
}
