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
    attach_image: 'სურათის მიმაგრება',
    remove_image: 'სურათის წაშლა',
    image_preview: 'სურათის გადახედვა',
    you: 'თქვენ',
    assistant: 'ასისტენტი',
    empty_state: 'აირჩიეთ მოდელი და დაიწყეთ საუბარი',
    error: 'დაფიქსირდა შეცდომა. სცადეთ თავიდან.',
    vision_only: 'სურათის ატვირთვა ხელმისაწვდოლია მხოლოდ ხედვის მხარდაჭერის მოდელებზე',
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
