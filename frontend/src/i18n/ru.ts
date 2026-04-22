import type { Messages } from './en'

const messages: Messages = {
  app: {
    title: 'GeoSoft AI Чат',
  },
  login: {
    title: 'Вход',
    username: 'Имя пользователя',
    password: 'Пароль',
    submit: 'Войти',
    error: 'Неверное имя пользователя или пароль',
    loading: 'Вход...',
  },
  nav: {
    logout: 'Выйти',
    theme: {
      light: 'Светлая тема',
      dark: 'Тёмная тема',
    },
  },
  models: {
    label: 'Модель ИИ',
    placeholder: 'Выберите модель',
    vision_badge: 'Зрение',
    deprecated: 'устарело',
    groups: {
      text: 'Текстовые модели',
      vision: 'Модели с зрением',
    },
  },
  rag: {
    label: 'Использовать базу знаний geosoft.ge',
    tooltip: 'Если включено, ответы дополняются материалами с geosoft.ge (RAG)',
  },
  chat: {
    placeholder: 'Введите сообщение...',
    send: 'Отправить',
    thinking: 'Думает...',
    attach_image: 'Прикрепить изображение',
    remove_image: 'Удалить изображение',
    image_preview: 'Предпросмотр',
    you: 'Вы',
    assistant: 'Ассистент',
    empty_state: 'Выберите модель и начните чат',
    error: 'Что-то пошло не так. Попробуйте снова.',
    vision_only: 'Загрузка изображений доступна только для моделей с поддержкой зрения',
  },
  upload: {
    uploading: 'Загрузка...',
    error: 'Не удалось загрузить. Попробуйте снова.',
    invalid_type: 'Разрешены только JPG, PNG, WebP и GIF',
    too_large: 'Размер изображения должен быть меньше 10 МБ',
  },
  language: {
    label: 'Язык',
    ka: 'Грузинский',
    ru: 'Русский',
    en: 'Английский',
  },
  common: {
    loading: 'Загрузка...',
    error: 'Ошибка',
    retry: 'Повторить',
    close: 'Закрыть',
  },
}

export default messages
