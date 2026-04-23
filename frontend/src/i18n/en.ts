const messages = {
  app: {
    title: 'GeoSoft AI Chat',
  },
  login: {
    title: 'Sign In',
    username: 'Username',
    password: 'Password',
    submit: 'Sign In',
    error: 'Invalid username or password',
    loading: 'Signing in...',
  },
  nav: {
    logout: 'Log Out',
    theme: {
      light: 'Light Mode',
      dark: 'Dark Mode',
    },
  },
  models: {
    label: 'AI Model',
    placeholder: 'Select a model',
    vision_badge: 'Vision',
    deprecated: 'deprecated',
    groups: {
      text: 'Text Models',
      vision: 'Vision Models',
    },
  },
  rag: {
    label: 'Use geosoft.ge knowledge base',
    tooltip: 'When enabled, answers are augmented with content from geosoft.ge',
  },
  chat: {
    placeholder: 'Type a message…',
    send: 'Send',
    thinking: 'Thinking…',
    attach_image: 'Add photos',
    image_message_placeholder: '(Photos attached — describe anything specific you want assessed.)',
    drop_images: 'Drop images to attach',
    max_images_reached: 'You already have the maximum number of photos (12). Remove one to add more.',
    remove_image: 'Remove',
    image_preview: 'Image preview',
    you: 'You',
    assistant: 'Assistant',
    empty_state: 'Start a conversation or pick a chat from the sidebar',
    error: 'Something went wrong. Please try again.',
    load_history_error: 'Could not load this chat. Try again or choose another session.',
    vision_only: 'Image upload is only available for vision-capable models',
    sessions_title: 'Chats for this model',
    session_untitled: 'New chat',
    new_session: 'New chat',
    delete_session: 'Delete chat',
    chat_create_error: 'Could not start a chat session.',
    image_enlarge: 'View image larger',
    lightbox_close: 'Close',
    rename_session: 'Rename chat',
    rename_save: 'Save',
    rename_cancel: 'Cancel',
    rename_placeholder: 'Chat title',
    model_current: 'Model',
  },
  upload: {
    uploading: 'Uploading...',
    error: 'Upload failed. Please try again.',
    invalid_type: 'Only JPG, PNG, WebP, and GIF images are allowed',
    too_large: 'Image must be under 10MB',
  },
  language: {
    label: 'Language',
    ka: 'Georgian',
    ru: 'Russian',
    en: 'English',
  },
  common: {
    loading: 'Loading...',
    error: 'Error',
    retry: 'Retry',
    close: 'Close',
  },
}

export type Messages = typeof messages
export default messages
