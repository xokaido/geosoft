import type { Messages } from './en'

const messages: Messages = {
  app: {
    title: 'GeoSoft AI ჩეთი',
  },
  login: {
    title: 'შესვლა',
    username: 'მომხმარებლის სახელი',
    password: 'პაროლი',
    submit: 'შესვლა',
    error: 'არასწორი მომხმარებლის სახელი ან პაროლი',
    loading: 'შესვლა...',
  },
  nav: {
    logout: 'გასვლა',
    theme: {
      light: 'ნათელი რეჟიმი',
      dark: 'მუქი რეჟიმი',
    },
  },
  models: {
    label: 'AI მოდელი',
    placeholder: 'აირჩიეთ მოდელი',
    vision_badge: 'ხედვა',
    deprecated: 'მოძველებული',
    groups: {
      text: 'ტექსტური მოდელები',
      vision: 'ვიზუალური მოდელები',
    },
  },
  rag: {
    label: 'geosoft.ge-ის ცოდნის ბაზის გამოყენება',
    tooltip: 'ჩართვისას პასუხები ივსება geosoft.ge-ის შინაარსით (RAG)',
  },
  chat: {
    placeholder: 'დაწერეთ შეტყობინება...',
    send: 'გაგზავნა',
    thinking: 'ფიქრობს...',
    attach_image: 'ფოტოების დამატება',
    image_message_placeholder: '(ფოტოები მიმაგრებულია — დაწერეთ რა გსურთ შეფასდეს.)',
    drop_images: 'გადააგდეთ სურათები მისაბმელად',
    max_images_reached: 'უკვე გაქვთ მაქსიმალური რაოდენობის ფოტო (12). წაშალეთ ერთი, რომ დაამატოთ.',
    remove_image: 'სურათის წაშლა',
    image_preview: 'სურათის გადახედვა',
    you: 'თქვენ',
    assistant: 'ასისტენტი',
    empty_state: 'დაიწყეთ საუბარი ან აირჩიეთ სესია გვერდითა პანელიდან',
    error: 'დაფიქსირდა შეცდომა. სცადეთ თავიდან.',
    load_history_error: 'საუბრის ჩატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა ან სხვა სესია.',
    vision_only: 'სურათის ატვირთვა ხელმისაწვდოლია მხოლოდ ხედვის მხარდაჭერის მოდელებზე',
    sessions_title: 'საუბრები ამ მოდელით',
    session_untitled: 'ახალი საუბარი',
    new_session: 'ახალი საუბარი',
    delete_session: 'საუბრის წაშლა',
    chat_create_error: 'საუბრის სესიის დაწყება ვერ მოხერხდა.',
    image_enlarge: 'სურათის გადიდება',
    lightbox_close: 'დახურვა',
    rename_session: 'სახელის შეცვლა',
    rename_save: 'შენახვა',
    rename_cancel: 'გაუქმება',
    rename_placeholder: 'საუბრის სათაური',
    model_current: 'მოდელი',
    verdict_eyebrow: 'დასკვნა',
    verdict_grade_sub: 'საერთო შეფასება',
  },
  upload: {
    uploading: 'იტვირთება...',
    error: 'ატვირთვა ვერ მოხერხდა. სცადეთ თავიდან.',
    invalid_type: 'დაშვებულია მხოლოდ JPG, PNG, WebP და GIF',
    too_large: 'სურათი უნდა იყოს 10MB-ზე ნაკლები',
  },
  language: {
    label: 'ენა',
    ka: 'ქართული',
    ru: 'რუსული',
    en: 'ინგლისური',
  },
  common: {
    loading: 'იტვირთება...',
    error: 'შეცდომა',
    retry: 'ხელახლა',
    close: 'დახურვა',
  },
}

export default messages
