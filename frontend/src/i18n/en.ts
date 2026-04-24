const messages = {
  app: {
    title: 'GeoSoft Cloud Chat',
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
    prompt_optional_hint: 'Optional: add a note about what you want assessed.',
    drop_images: 'Drop images to attach',
    max_images_reached: 'You already have the maximum number of photos (12). Remove one to add more.',
    remove_image: 'Remove',
    image_preview: 'Image preview',
    you: 'You',
    assistant: 'Assistant',
    empty_state: 'Start a conversation or pick a chat from the sidebar',
    error: 'Something went wrong. Please try again.',
    openrouter_unavailable:
      'The AI service is temporarily unavailable (no provider could handle this request). Wait a moment, try fewer images, or choose another model.',
    openrouter_bad_gateway:
      'The model provider returned an error. Try again in a few seconds or pick a different model.',
    openrouter_unauthorized:
      'AI service authentication failed. The OpenRouter API key may be missing or invalid.',
    openrouter_payment_required:
      'The OpenRouter account has insufficient credits. Add credits and try again.',
    openrouter_moderation: 'The message was blocked by content policy. Revise the text or images and try again.',
    openrouter_rate_limit: 'Too many requests. Wait a short moment and try again.',
    openrouter_timeout: 'The request timed out. Try again with a shorter message or fewer images.',
    openrouter_bad_request: 'The request could not be processed. Try simplifying the message or attachments.',
    openrouter_generic: 'The AI service returned an error. Please try again.',
    load_history_error: 'Could not load this chat. Try again or choose another session.',
    vision_only: 'Image upload is only available for vision-capable models',
    sessions_title: 'Chats for this model',
    session_untitled: 'New chat',
    new_session: 'New chat',
    delete_session: 'Delete chat',
    chat_create_error: 'Could not start a chat session.',
    image_enlarge: 'View image larger',
    lightbox_close: 'Close',
    lightbox_prev: 'Previous image',
    lightbox_next: 'Next image',
    rename_session: 'Rename chat',
    rename_save: 'Save',
    rename_cancel: 'Cancel',
    rename_placeholder: 'Chat title',
    model_current: 'Model',
    verdict_eyebrow: 'Verdict',
    verdict_grade_sub: 'Overall grade',
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
