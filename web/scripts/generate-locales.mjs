import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, "..", "dist");
const template = readFileSync(join(dist, "index.html"), "utf8");
const site = "https://svg.pifagorstudio.com";

const pages = {
  en: {
    title: "Pifagor SVG Optimize - Browser SVG optimizer",
    description:
      "Optimize and clean SVG files in your browser. Batch SVG optimization, logo-safe mode, no uploads, no server processing, no registration."
  },
  ru: {
    title: "Pifagor SVG Optimize - оптимизация SVG в браузере",
    description:
      "Оптимизируйте и очищайте SVG прямо в браузере. Массовая обработка, режим для логотипов, без загрузки файлов на сервер и без регистрации."
  },
  uk: {
    title: "Pifagor SVG Optimize - оптимізація SVG у браузері",
    description:
      "Оптимізуйте й очищайте SVG у браузері. Пакетна обробка, режим для логотипів, без завантаження файлів на сервер і без реєстрації."
  },
  es: {
    title: "Pifagor SVG Optimize - optimizador SVG en el navegador",
    description:
      "Optimiza y limpia SVG en tu navegador. Procesamiento por lotes, modo para logotipos, sin subir archivos al servidor y sin registro."
  },
  de: {
    title: "Pifagor SVG Optimize - SVG-Optimierer im Browser",
    description:
      "Optimiere und bereinige SVG-Dateien im Browser. Stapelverarbeitung, Logo-Modus, keine Uploads zum Server und keine Registrierung."
  }
};

for (const [locale, page] of Object.entries(pages)) {
  const canonical = locale === "en" ? `${site}/en/` : `${site}/${locale}/`;
  const html = template
    .replace(/<html lang="[^"]+"/, `<html lang="${locale}"`)
    .replace(/<title>.*?<\/title>/, `<title>${page.title}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${page.description}" />`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${page.title}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${page.description}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${canonical}" />`);

  const directory = join(dist, locale);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "index.html"), html);
}
