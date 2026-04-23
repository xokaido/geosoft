import type { Messages } from './en'

const messages: Messages = {
  app: {
    title: 'GeoSoft Cloud Чат',
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
    attach_image: 'Добавить фото',
    image_message_placeholder: '(Фото прикреплены — уточните, что именно оценить.)',
    prompt_optional_hint: 'Необязательно: добавьте, что именно нужно оценить.',
    drop_images: 'Отпустите изображения, чтобы прикрепить',
    max_images_reached: 'Уже максимум фото (12). Удалите одно, чтобы добавить ещё.',
    remove_image: 'Удалить изображение',
    image_preview: 'Предпросмотр',
    you: 'Вы',
    assistant: 'Ассистент',
    empty_state: 'Начните диалог или выберите чат в боковой панели',
    error: 'Что-то пошло не так. Попробуйте снова.',
    load_history_error: 'Не удалось загрузить чат. Повторите попытку или выберите другую сессию.',
    vision_only: 'Загрузка изображений доступна только для моделей с поддержкой зрения',
    sessions_title: 'Чаты с этой моделью',
    session_untitled: 'Новый чат',
    new_session: 'Новый чат',
    delete_session: 'Удалить чат',
    chat_create_error: 'Не удалось создать сессию чата.',
    image_enlarge: 'Увеличить изображение',
    lightbox_close: 'Закрыть',
    rename_session: 'Переименовать',
    rename_save: 'Сохранить',
    rename_cancel: 'Отмена',
    rename_placeholder: 'Название чата',
    model_current: 'Модель',
    verdict_eyebrow: 'Вердикт',
    verdict_grade_sub: 'Общая оценка',
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
