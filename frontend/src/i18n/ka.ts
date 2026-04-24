import type { Messages } from './en'

const messages: Messages = {
  app: {
    title: 'GeoSoft Cloud ჩეთი',
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
    prompt_optional_hint: 'სურვილისამებრ: მიუთითეთ, რისი შეფასება გსურთ.',
    drop_images: 'გადააგდეთ სურათები მისაბმელად',
    max_images_reached: 'უკვე გაქვთ მაქსიმალური რაოდენობის ფოტო (12). წაშალეთ ერთი, რომ დაამატოთ.',
    remove_image: 'სურათის წაშლა',
    image_preview: 'სურათის გადახედვა',
    you: 'თქვენ',
    assistant: 'ასისტენტი',
    empty_state: 'დაიწყეთ საუბარი ან აირჩიეთ სესია გვერდითა პანელიდან',
    error: 'დაფიქსირდა შეცდომა. სცადეთ თავიდან.',
    openrouter_unavailable:
      'AI სერვისი დროებით მიუწვდომელია (პროვაიდერი ვერ დაამუშავა მოთხოვნას). მოიცადეთ, გამცილებით ნაკლები სურათი გამოგზავნეთ ან სხვა მოდელი აირჩიეთ.',
    openrouter_bad_gateway:
      'მოდელის პროვაიდერი მოულოდნელმა პასუხმა. სცადეთ ხელახლა ან აირჩიეთ სხვა მოდელი.',
    openrouter_unauthorized:
      'AI სერვისთან ავთენტიკაცია ჩავარდა. შეამოწმეთ OpenRouter API გასაღები.',
    openrouter_payment_required: 'OpenRouter-ზე არასაკმარისია კრედიტი. დაგირიცხეთ თანხა და სცადეთ ისევ.',
    openrouter_moderation: 'შეტყობინება შინაარსის პოლიტიკამ დაბლოკა. გადააყვანეთ ტექსტი/სურათები და სცადეთ ისევ.',
    openrouter_rate_limit: 'ძალიან ბევრი მოთხოვნა. მცირე პაუზის შემდეგ სცადეთ ისევ.',
    openrouter_timeout: 'ვადა ამოიწურა. სცადეთ უფორმიანი ტექსტით ან ნაკლებით სურათებით.',
    openrouter_bad_request: 'მოთხოვნა ვერ დამუშავდა. გაამარტივეთ ტექსტი ან დანართები.',
    openrouter_generic: 'AI სერვისმა შეცდომა დააბრუნა. სცადეთ თავიდან.',
    load_history_error: 'საუბრის ჩატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა ან სხვა სესია.',
    vision_only: 'სურათის ატვირთვა ხელმისაწვდოლია მხოლოდ ხედვის მხარდაჭერის მოდელებზე',
    sessions_title: 'საუბრები ამ მოდელით',
    session_untitled: 'ახალი საუბარი',
    new_session: 'ახალი საუბარი',
    delete_session: 'საუბრის წაშლა',
    chat_create_error: 'საუბრის სესიის დაწყება ვერ მოხერხდა.',
    image_enlarge: 'სურათის გადიდება',
    lightbox_close: 'დახურვა',
    lightbox_prev: 'წინა სურათი',
    lightbox_next: 'შემდეგი სურათი',
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
