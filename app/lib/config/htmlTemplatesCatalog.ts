export type TemplateMeta = {
  id: string;
  name: string;
  category: "food" | "beauty" | "creative" | "service" | "event" | "business" | "personal" | "generic";
  description: string;
  bestFor: string[];
  sections: string[];
  style: string;
  colorMood: string;
  emoji: string;
};

export const TEMPLATE_CATALOG: TemplateMeta[] = [
  {
    id: "coffee-shop",
    name: "Кофейня / Кафе",
    category: "food",
    description: "Уютный лендинг для кофейни, кафе, пекарни, бистро. Меню, часы работы, адрес.",
    bestFor: ["кофейня", "кафе", "пекарня", "бариста", "бранч", "завтраки", "десерты"],
    sections: ["hero", "menu", "hours", "location", "contact"],
    style: "warm-minimalist",
    colorMood: "warm-pastel",
    emoji: "☕",
  },
  {
    id: "barbershop",
    name: "Барбершоп",
    category: "beauty",
    description: "Брутальный лендинг для барбершопа, мужской парикмахерской. Услуги, мастера, запись.",
    bestFor: ["барбершоп", "стрижка", "борода", "мастер", "парикмахер"],
    sections: ["hero", "services", "masters", "booking"],
    style: "bold-dark",
    colorMood: "dark-premium",
    emoji: "💈",
  },
  {
    id: "photographer",
    name: "Фотограф",
    category: "creative",
    description: "Портфолио фотографа. Галерея работ, услуги, контакты. Свадьбы, семья, студия, репортаж.",
    bestFor: ["фотограф", "фотосессия", "свадьба", "портфолио", "съёмка"],
    sections: ["hero", "gallery", "services", "about", "contact"],
    style: "editorial",
    colorMood: "light-minimal",
    emoji: "📸",
  },
  {
    id: "portfolio-dev",
    name: "Личная страница",
    category: "personal",
    description: "Личный сайт разработчика, дизайнера, фрилансера. Проекты, навыки, контакты.",
    bestFor: ["разработчик", "дизайнер", "фрилансер", "портфолио", "резюме"],
    sections: ["hero", "about", "projects", "skills", "contact"],
    style: "tech-minimal",
    colorMood: "cool-mono",
    emoji: "👤",
  },
  {
    id: "wedding",
    name: "Свадьба",
    category: "event",
    description: "Сайт-приглашение на свадьбу. История пары, программа, локация, форма ответа.",
    bestFor: ["свадьба", "приглашение", "молодожёны", "торжество"],
    sections: ["hero", "story", "schedule", "location", "rsvp"],
    style: "romantic",
    colorMood: "warm-pastel",
    emoji: "💒",
  },
  {
    id: "fitness-trainer",
    name: "Фитнес-тренер",
    category: "service",
    description: "Персональный тренер, фитнес-студия. Программы, цены, запись на тренировку.",
    bestFor: ["тренер", "фитнес", "зал", "тренировки", "спорт", "похудение"],
    sections: ["hero", "programs", "about", "pricing", "contact"],
    style: "energetic",
    colorMood: "bold-contrast",
    emoji: "💪",
  },
  {
    id: "restaurant",
    name: "Ресторан",
    category: "food",
    description: "Лендинг для ресторана. Атмосфера, меню с фото, бронирование столика.",
    bestFor: ["ресторан", "кухня", "шеф", "ужин", "бронь"],
    sections: ["hero", "about", "menu-highlights", "gallery", "booking", "location"],
    style: "elegant-dark",
    colorMood: "dark-premium",
    emoji: "🍽️",
  },
  {
    id: "tutor",
    name: "Репетитор",
    category: "service",
    description: "Репетитор по языкам, математике, подготовка к экзаменам. Цены, отзывы, запись.",
    bestFor: ["репетитор", "преподаватель", "уроки", "обучение", "язык", "экзамен", "цт", "егэ"],
    sections: ["hero", "subjects", "about", "pricing", "reviews", "contact"],
    style: "academic-warm",
    colorMood: "light-minimal",
    emoji: "📚",
  },
  {
    id: "beauty-master",
    name: "Мастер маникюра",
    category: "beauty",
    description: "Маникюр, педикюр и дизайн ногтей. Работы, прайс, запись.",
    bestFor: ["маникюр", "педикюр", "ногт", "ноготочк", "нейл", "nail", "гель-лак"],
    sections: ["hero", "services", "gallery", "pricing", "booking"],
    style: "feminine-soft",
    colorMood: "warm-pastel",
    emoji: "💅",
  },
  {
    id: "service-studio",
    name: "Студия красоты и ухода",
    category: "beauty",
    description: "Нейтральный тёплый шаблон для бьюти/велнес-услуг: ресницы, брови, косметология, депиляция, массаж, спа. Услуги, цены, отзывы, запись.",
    bestFor: ["ресниц", "наращивание ресниц", "ламинирование ресниц", "бров", "визаж", "косметолог", "косметологи", "чистка лица", "пилинг", "депиляци", "эпиляци", "шугаринг", "массаж", "спа-салон", "велнес", "бьюти", "уход за лицом", "уход за телом"],
    sections: ["hero", "features", "services", "pricing", "testimonials", "faq", "contact"],
    style: "warm-editorial-soft",
    colorMood: "warm-pastel",
    emoji: "✨",
  },
  {
    id: "car-service",
    name: "Автосервис",
    category: "service",
    description: "Ремонт авто, шиномонтаж, диагностика. Услуги, цены, контакты.",
    bestFor: ["сто", "автосервис", "ремонт", "шиномонтаж", "диагностика", "авто"],
    sections: ["hero", "services", "pricing", "why-us", "contact"],
    style: "industrial",
    colorMood: "bold-contrast",
    emoji: "🔧",
  },
  {
    id: "handmade-shop",
    name: "Ручная работа",
    category: "creative",
    description: "Торты на заказ, свечи, керамика, украшения. Галерея работ и заказ.",
    bestFor: ["торты", "хендмейд", "украшения", "свечи", "керамика", "на заказ", "мастерская"],
    sections: ["hero", "gallery", "about", "order-form", "contact"],
    style: "cozy-craft",
    colorMood: "warm-pastel",
    emoji: "🎨",
  },
  {
    id: "dj-music",
    name: "Диджей / Музыкант",
    category: "creative",
    description: "Сайт диджея, музыканта, группы. Треки, ивенты, бронь на мероприятие.",
    bestFor: ["dj", "диджей", "музыкант", "группа", "ивент", "вечеринка"],
    sections: ["hero", "tracks", "events", "booking", "contact"],
    style: "neon-club",
    colorMood: "vibrant-neon",
    emoji: "🎧",
  },
  {
    id: "saas-landing",
    name: "Своё приложение",
    category: "business",
    description: "Лендинг для приложения, сервиса, своего стартапа. Возможности, цены, призыв к регистрации.",
    bestFor: ["saas", "приложение", "сервис", "стартап", "продукт", "b2b"],
    sections: ["hero", "features", "how-it-works", "pricing", "testimonials", "cta"],
    style: "tech-modern",
    colorMood: "cool-mono",
    emoji: "🚀",
  },
  {
    id: "medical-clinic",
    name: "Клиника",
    category: "service",
    description: "Стоматология, медцентр, клиника. Услуги, врачи, запись на приём.",
    bestFor: ["стоматология", "клиника", "медцентр", "врач", "приём", "лечение"],
    sections: ["hero", "services", "doctors", "pricing", "booking", "contact"],
    style: "clean-medical",
    colorMood: "light-minimal",
    emoji: "🦷",
  },
  {
    id: "yoga-studio",
    name: "Йога",
    category: "service",
    description: "Йога-студия, медитация, оздоровление. Расписание, инструкторы, запись.",
    bestFor: ["йога", "медитация", "оздоровление", "студия", "практика"],
    sections: ["hero", "classes", "instructors", "schedule", "pricing", "contact"],
    style: "zen-soft",
    colorMood: "earth-natural",
    emoji: "🧘",
  },
  {
    id: "tattoo-studio",
    name: "Тату-студия",
    category: "beauty",
    description: "Брутальный сайт тату-студии. Мастера, стили, галерея работ, запись.",
    bestFor: ["тату", "татуировка", "тату-студия", "ink", "мастер тату"],
    sections: ["hero", "styles", "artists", "gallery", "booking"],
    style: "bold-dark-ink",
    colorMood: "dark-premium",
    emoji: "🖤",
  },
  {
    id: "flower-shop",
    name: "Цветы",
    category: "service",
    description: "Нежный сайт цветочного магазина. Букеты, каталог, доставка по городу.",
    bestFor: ["цветы", "букеты", "флорист", "доставка цветов", "свадьба цветы"],
    sections: ["hero", "bouquets", "occasions", "delivery", "contact"],
    style: "soft-feminine",
    colorMood: "warm-pastel",
    emoji: "💐",
  },
  {
    id: "language-school",
    name: "Языковая школа",
    category: "service",
    description: "Сайт школы иностранных языков. Курсы, преподаватели, цены, запись.",
    bestFor: ["английский", "языковая школа", "курсы", "преподаватель", "language"],
    sections: ["hero", "courses", "teachers", "pricing", "testimonials", "contact"],
    style: "academic-modern",
    colorMood: "cool-mono",
    emoji: "🗣️",
  },
  {
    id: "legal-firm",
    name: "Юристы",
    category: "business",
    description: "Строгий сайт юридической фирмы. Услуги, практики, команда, консультация.",
    bestFor: ["юрист", "адвокат", "юридические услуги", "суд", "консультация"],
    sections: ["hero", "practices", "team", "cases", "consultation", "contact"],
    style: "corporate-serious",
    colorMood: "dark-premium",
    emoji: "⚖️",
  },
  {
    id: "game-studio",
    name: "Игры",
    category: "creative",
    description: "Сайт инди-геймстудии. Игры, команда, дневник разработки, сообщество.",
    bestFor: ["игры", "геймстудия", "разработка игр", "инди", "гейминг"],
    sections: ["hero", "games", "about", "team", "devlog", "contact"],
    style: "neon-gamer",
    colorMood: "vibrant-neon",
    emoji: "🎮",
  },
  {
    id: "real-estate",
    name: "Недвижимость",
    category: "business",
    description: "Сайт агентства недвижимости. Объекты, риелторы, ипотека, контакты.",
    bestFor: ["недвижимость", "риелтор", "квартиры", "дома", "купить квартиру"],
    sections: ["hero", "listings", "services", "agents", "mortgage", "contact"],
    style: "elegant-professional",
    colorMood: "light-minimal",
    emoji: "🏠",
  },
  {
    id: "blank-landing",
    name: "Универсальный",
    category: "generic",
    description: "Базовый каркас лендинга на случай если ничего не подходит. Hero, about, features, contact.",
    bestFor: ["любой бизнес", "общий", "универсальный"],
    sections: ["hero", "about", "features", "contact"],
    style: "neutral-modern",
    colorMood: "light-minimal",
    emoji: "📄",
  },
];
export function getTemplateById(id: string): TemplateMeta | null {
  return TEMPLATE_CATALOG.find((t) => t.id === id) ?? null;
}

export function getFallbackTemplate(): TemplateMeta {
  return TEMPLATE_CATALOG.find((t) => t.id === "blank-landing")!;
}

export function buildCatalogForPrompt(filterIds?: string[]): string {
  const list =
    filterIds && filterIds.length > 0
      ? TEMPLATE_CATALOG.filter(
          (t) => filterIds.includes(t.id) || t.id === "blank-landing",
        )
      : TEMPLATE_CATALOG;
  return list
    .map(
      (t) =>
        `- ${t.id}: ${t.name} — ${t.description} (подходит для: ${t.bestFor.join(", ")})`,
    )
    .join("\n");
}
