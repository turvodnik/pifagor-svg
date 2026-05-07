import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, "..", "dist");
const template = readFileSync(join(dist, "index.html"), "utf8");
const site = "https://svg.pifagorstudio.com";
const ogLocales = {
  en: "en_US",
  ru: "ru_RU",
  uk: "uk_UA",
  es: "es_ES",
  de: "de_DE"
};

const pages = {
  en: {
    title: "Pifagor SVG Optimize | Free Browser SVG Optimizer",
    description:
      "Optimize SVG files and code locally in your browser. Batch processing, logo-safe cleanup, no uploads, no tracking, no registration.",
    imageAlt: "Pifagor Studio logo on a blue background"
  },
  ru: {
    title: "Pifagor SVG Optimize | Оптимизация SVG онлайн",
    description:
      "Оптимизируйте SVG-файлы и код прямо в браузере: массовая обработка, режим для логотипов, без загрузки на сервер, регистрации и отслеживания.",
    imageAlt: "Логотип Pifagor Studio на голубом фоне"
  },
  uk: {
    title: "Pifagor SVG Optimize | Оптимізація SVG онлайн",
    description:
      "Оптимізуйте SVG-файли та код прямо у браузері: пакетна обробка, режим для логотипів, без завантаження на сервер, реєстрації й трекінгу.",
    imageAlt: "Логотип Pifagor Studio на блакитному фоні"
  },
  es: {
    title: "Pifagor SVG Optimize | Optimizador SVG online",
    description:
      "Optimiza archivos y código SVG localmente en el navegador: procesamiento por lotes, modo para logotipos, sin subidas, rastreo ni registro.",
    imageAlt: "Logotipo de Pifagor Studio sobre fondo azul"
  },
  de: {
    title: "Pifagor SVG Optimize | SVG online optimieren",
    description:
      "Optimiere SVG-Dateien und Code lokal im Browser: Batch-Verarbeitung, Logo-sichere Bereinigung, keine Uploads, kein Tracking, keine Anmeldung.",
    imageAlt: "Pifagor Studio Logo auf blauem Hintergrund"
  }
};

function metaByName(name, content) {
  return `<meta name="${name}" content="${content}" />`;
}

function metaByProperty(property, content) {
  return `<meta property="${property}" content="${content}" />`;
}

for (const [locale, page] of Object.entries(pages)) {
  const canonical = locale === "en" ? `${site}/en/` : `${site}/${locale}/`;
  const ogLocaleAlternates = Object.entries(ogLocales)
    .filter(([item]) => item !== locale)
    .map(([, value]) => `    <meta property="og:locale:alternate" content="${value}" />`)
    .join("\n");

  const html = template
    .replace(/<html lang="[^"]+"/, `<html lang="${locale}"`)
    .replace(/<title>.*?<\/title>/, `<title>${page.title}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/s, metaByName("description", page.description))
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, metaByProperty("og:title", page.title))
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/s, metaByProperty("og:description", page.description))
    .replace(/<meta property="og:url" content="[^"]*" \/>/, metaByProperty("og:url", canonical))
    .replace(
      /(    <meta property="og:locale" content="[^"]*" \/>\n)(?:    <meta property="og:locale:alternate" content="[^"]*" \/>\n?)+/,
      `    <meta property="og:locale" content="${ogLocales[locale]}" />\n${ogLocaleAlternates}\n`
    )
    .replace(/<meta property="og:image:alt" content="[^"]*" \/>/, metaByProperty("og:image:alt", page.imageAlt))
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/, metaByName("twitter:title", page.title))
    .replace(/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/s, metaByName("twitter:description", page.description))
    .replace(/<meta name="twitter:image:alt" content="[^"]*" \/>/, metaByName("twitter:image:alt", page.imageAlt))
    .replace(
      /"description": "Optimize SVG files and code locally in your browser\. Batch processing, logo-safe cleanup, no uploads, no tracking, no registration\."/,
      `"description": ${JSON.stringify(page.description)}`
    )
    .replace(/"inLanguage": "en"/, `"inLanguage": "${locale}"`);

  const directory = join(dist, locale);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "index.html"), html);
}
