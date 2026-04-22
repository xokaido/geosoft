import type { PageRecord } from './lib/crawl-chunk'

/**
 * Curated bilingual summary aligned with public geosoft.ge positioning (cloud & vendor stack).
 * Used as (1) Vectorize seed URLs so “რას ყიდის ჯეოსოფტი?”-style questions match, and (2) assistant
 * fallback when RAG returns no hits — keeps tone friendly and on-brand.
 */
const OVERVIEW_KA = `
ჯეოსოფტი (Geosoft, geosoft.ge) საქართველოში მოქმედი ტექნოლოგიური პარტნიორია, რომელიც ეხმარება ორგანიზაციებს ქლაუდ ტექნოლოგიებისა და ციფრული სამუშაო გარემოს დანერგვაში.

რას ვთავაზობთ მაღალი დონით:
• Google Workspace — ელფოსტა, კალენდარი, Drive, Docs, Sheets, Meet და სხვა პროდუქტიულობის ინსტრუმენტები გუნდებისთვის.
• Google Cloud Platform — ქლაუდ ინფრასტრუქტურა, ანალიტიკა, AI/ML ინსტრუმენტები, ჰიბრიდული გადაწყვეტები.
• Microsoft 365 — Word, Excel, Outlook, PowerPoint, Teams, OneDrive და უსაფრთხო თანამშრომლობა.
• Google Workspace for Education — Classroom, Docs, Meet და სხვა სასწავლო ინსტრუმენტები.
• Synology NAS — სარეზერვო კოპირება, ფაილების საცავი და მართვა სახლისა და ბიზნესისთვის.
• Google Maps Platform — ლოკაციის API-ები, რუკები და გეოსერვისები დეველოპერებისთვის.
• Amazon Web Services (AWS) — ქლაუდ გამოთვლები, საცავი, ბაზები და მასშტაბირება.

სერვისების მიმართულებები: არსებული გარემოს აუდიტი, მიგრაციის სტრატეგია, ქლაუდ კონფიგურაცია, მონაცემთა მიგრაცია, მომხმარებელთა ტრენინგი და მხარდაჭერა.

დეტალური შეთავაზებები და ფასები განახლებულია საიტზე geosoft.ge — მომხმარებლისთვის მიუთითეთ საიტი ან კონტაქტი დამატებითი ინფორმაციისთვის.
`.trim()

const OVERVIEW_EN = `
GeoSoft (geosoft.ge) is a Georgia-based technology partner helping organizations adopt cloud platforms and a modern digital workplace.

What GeoSoft works with at a high level:
• Google Workspace — Gmail, Calendar, Drive, Docs, Sheets, Meet, and collaboration for teams.
• Google Cloud Platform — cloud infrastructure, analytics, AI/ML tooling, hybrid approaches.
• Microsoft 365 — Word, Excel, Outlook, PowerPoint, Teams, OneDrive, and secure teamwork.
• Google Workspace for Education — Classroom, Docs, Meet, and learning tools.
• Synology NAS — backups, file storage, and management for home and business.
• Google Maps Platform — location APIs, maps, and geo services for developers.
• Amazon Web Services (AWS) — compute, storage, databases, and scale-out cloud.

Services include: environment assessment, migration planning, cloud configuration, data migration, training, and ongoing support.

For up-to-date offerings and pricing, point people to geosoft.ge or GeoSoft contact channels rather than guessing specifics.
`.trim()

/** Extra pages merged into crawl ingest so Vectorize always has product-oriented snippets. */
export function geosoftOverviewSeedPages(): PageRecord[] {
  return [
    {
      url: 'https://geosoft.ge/__kb__/overview-ka',
      title: 'GeoSoft — პროდუქტები და სერვისები (შინაარსი)',
      text: OVERVIEW_KA,
    },
    {
      url: 'https://geosoft.ge/__kb__/overview-en',
      title: 'GeoSoft — products and services (summary)',
      text: OVERVIEW_EN,
    },
  ]
}

/** Injected into chat when RAG is on but retrieval is empty — friendly + accurate baseline. */
export function geosoftAssistantFallbackContext(): string {
  return `### ოფიციალური მიმოხილვა (ქართული)\n${OVERVIEW_KA}\n\n### Official summary (English)\n${OVERVIEW_EN}`
}
