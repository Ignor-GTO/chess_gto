/**
 * i18n.js — мультиязычность (ru / uz / en)
 * Используется vue-i18n v9
 */
import { createI18n } from 'vue-i18n';

// ─── Переводы ────────────────────────────────────────────────────────────────

const messages = {
  ru: {
    nav: {
      play: 'Играть',
      analyze: 'Анализ',
      profile: 'Профиль',
      history: 'История',
      logout: 'Выйти',
    },
    game: {
      myTurn: 'Ваш ход',
      opponentTurn: 'Ход соперника',
      resign: 'Сдаться',
      draw: 'Ничья',
      offerDraw: 'Предложить ничью',
      acceptDraw: 'Принять ничью',
      declineDraw: 'Отклонить',
      drawOffered: 'Соперник предлагает ничью',
      yourColor: {
        white: 'Вы играете белыми',
        black: 'Вы играете чёрными',
      },
    },
    result: {
      white_win: 'Победа белых',
      black_win: 'Победа чёрных',
      draw: 'Ничья',
      youWin: '🏆 Вы победили!',
      youLose: '😢 Поражение',
      draw_result: '🤝 Ничья',
      reasons: {
        checkmate: 'Мат',
        resign: 'Сдача',
        timeout: 'Время вышло',
        stalemate: 'Пат',
        draw_agreement: 'Взаимное согласие',
        insufficient_material: 'Недостаточно материала',
      },
    },
    analysis: {
      title: 'Анализ партии',
      startBtn: 'Запустить разбор тренера',
      voiceBtn: 'Голосовой отчёт',
      analyzing: 'Анализирую ход {current} из {total}...',
      accuracy: 'Точность',
      report: 'Отчёт тренера',
      classifications: {
        brilliant: '!! Блестящий',
        great: '! Отличный',
        best: '★ Лучший',
        excellent: '✓ Хороший',
        good: '· Нормальный',
        book: '📖 Теория',
        inaccuracy: '?! Неточность',
        mistake: '? Ошибка',
        blunder: '?? Зевок',
      },
    },
    lobby: {
      title: 'Найти партию',
      tabs: { online: 'Онлайн', bot: 'Против бота' },
      timeControls: {
        bullet: 'Буллит', blitz: 'Блиц', rapid: 'Рапид', classical: 'Классика',
      },
      searching: 'Поиск соперника...',
      cancel: 'Отмена',
      onlineCount: '{count} игроков онлайн',
      bot: {
        chooseLevel: 'Выберите уровень бота',
        chooseColor: 'Ваш цвет',
        start: 'Играть против бота',
      },
    },
    auth: {
      login: 'Войти',
      register: 'Регистрация',
      username: 'Имя пользователя',
      email: 'Email',
      password: 'Пароль',
      forgotPassword: 'Забыли пароль?',
      noAccount: 'Нет аккаунта?',
      hasAccount: 'Уже есть аккаунт?',
    },
    profile: {
      rating: 'Рейтинг',
      games: 'Партии',
      wins: 'Победы',
      losses: 'Поражения',
      draws: 'Ничьи',
      winRate: 'Процент побед',
      history: 'История игр',
    },
    errors: {
      connectionLost: 'Соединение потеряно. Переподключение...',
      illegalMove: 'Недопустимый ход',
      notYourTurn: 'Сейчас не ваш ход',
    },
  },

  uz: {
    nav: {
      play: 'O\'ynash',
      analyze: 'Tahlil',
      profile: 'Profil',
      history: 'Tarix',
      logout: 'Chiqish',
    },
    game: {
      myTurn: 'Sizning yurishingiz',
      opponentTurn: 'Raqib yurishi',
      resign: 'Taslim bo\'lish',
      draw: 'Durang',
      offerDraw: 'Durang taklif qilish',
      acceptDraw: 'Durangni qabul qilish',
      declineDraw: 'Rad etish',
      drawOffered: 'Raqib durang taklif qilmoqda',
      yourColor: {
        white: 'Siz oq donalar bilan o\'ynaysiz',
        black: 'Siz qora donalar bilan o\'ynaysiz',
      },
    },
    result: {
      white_win: 'Oqlar g\'alaba qildi',
      black_win: 'Qoralar g\'alaba qildi',
      draw: 'Durang',
      youWin: '🏆 Siz yutdingiz!',
      youLose: '😢 Mag\'lubiyat',
      draw_result: '🤝 Durang',
      reasons: {
        checkmate: 'Mat',
        resign: 'Taslim',
        timeout: 'Vaqt tugadi',
        stalemate: 'Pat',
        draw_agreement: 'O\'zaro kelishuv',
        insufficient_material: 'Material yetarli emas',
      },
    },
    analysis: {
      title: 'O\'yinni tahlil qilish',
      startBtn: 'Murabbiy tahlilini boshlash',
      voiceBtn: 'Ovozli hisobot',
      analyzing: '{total} ta yurish ichida {current} tahlil qilinmoqda...',
      accuracy: 'Aniqlik',
      report: 'Murabbiy hisoboti',
    },
    lobby: {
      title: 'O\'yin topish',
      searching: 'Raqib qidirилmoqda...',
      cancel: 'Bekor qilish',
    },
    auth: {
      login: 'Kirish',
      register: 'Ro\'yxatdan o\'tish',
      username: 'Foydalanuvchi nomi',
      email: 'Email',
      password: 'Parol',
    },
    profile: {
      rating: 'Reyting',
      games: 'O\'yinlar',
      wins: 'G\'alabalar',
      losses: 'Mag\'lubiyatlar',
      draws: 'Duranglar',
      winRate: 'G\'alaba foizi',
      history: 'O\'yinlar tarixi',
    },
    errors: {
      connectionLost: 'Ulanish yo\'qoldi. Qayta ulanish...',
      illegalMove: 'Noto\'g\'ri yurish',
      notYourTurn: 'Hozir sizning navbatingiz emas',
    },
  },

  en: {
    nav: {
      play: 'Play',
      analyze: 'Analysis',
      profile: 'Profile',
      history: 'History',
      logout: 'Logout',
    },
    game: {
      myTurn: 'Your turn',
      opponentTurn: 'Opponent\'s turn',
      resign: 'Resign',
      draw: 'Draw',
      offerDraw: 'Offer Draw',
      acceptDraw: 'Accept Draw',
      declineDraw: 'Decline',
      drawOffered: 'Opponent offers a draw',
      yourColor: {
        white: 'You play as White',
        black: 'You play as Black',
      },
    },
    result: {
      white_win: 'White wins',
      black_win: 'Black wins',
      draw: 'Draw',
      youWin: '🏆 You won!',
      youLose: '😢 You lost',
      draw_result: '🤝 Draw',
      reasons: {
        checkmate: 'Checkmate',
        resign: 'Resignation',
        timeout: 'Timeout',
        stalemate: 'Stalemate',
        draw_agreement: 'Agreement',
        insufficient_material: 'Insufficient material',
      },
    },
    analysis: {
      title: 'Game Analysis',
      startBtn: 'Start Coach Analysis',
      voiceBtn: 'Voice Report',
      analyzing: 'Analyzing move {current} of {total}...',
      accuracy: 'Accuracy',
      report: 'Coach Report',
      classifications: {
        brilliant: '!! Brilliant',
        great: '! Great',
        best: '★ Best',
        excellent: '✓ Excellent',
        good: '· Good',
        book: '📖 Book',
        inaccuracy: '?! Inaccuracy',
        mistake: '? Mistake',
        blunder: '?? Blunder',
      },
    },
    lobby: {
      title: 'Find a Game',
      searching: 'Searching for opponent...',
      cancel: 'Cancel',
    },
    auth: {
      login: 'Sign In',
      register: 'Register',
      username: 'Username',
      email: 'Email',
      password: 'Password',
    },
    profile: {
      rating: 'Rating',
      games: 'Games',
      wins: 'Wins',
      losses: 'Losses',
      draws: 'Draws',
      winRate: 'Win Rate',
      history: 'Game History',
    },
    errors: {
      connectionLost: 'Connection lost. Reconnecting...',
      illegalMove: 'Illegal move',
      notYourTurn: 'Not your turn',
    },
  },
};

// ─── Создание i18n ────────────────────────────────────────────────────────────

const savedLang = localStorage.getItem('lang') || 'ru';

export const i18n = createI18n({
  legacy: false,          // Composition API
  locale: savedLang,
  fallbackLocale: 'en',
  messages,
});

export function setLanguage(lang) {
  i18n.global.locale.value = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
}
