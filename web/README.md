# Pifagor SVG Optimize Web

Browser-only SVG optimizer for `svg.pifagorstudio.com`.

## Local Development

```bash
cd web
npm install
npm run dev
```

## Cloudflare Pages

- Production branch: `main`
- Root directory: `web`
- Build command: `npm run build`
- Output directory: `dist`
- Custom domain: `svg.pifagorstudio.com`

The app is static. SVG files are processed locally in the browser and are not sent to the server.

## Browser Support

The app targets modern evergreen browsers on macOS, Windows, Linux, iOS, and Android:

- Chrome / Edge / Brave / Opera
- Firefox
- Safari on macOS and iOS
- Android Chrome

Core file optimization works with normal file selection everywhere. Folder picking is a progressive enhancement where the browser supports directory inputs. If module Web Workers or Clipboard API are unavailable, the app falls back to main-thread processing and a legacy copy flow.

## Docker

```bash
docker compose build
docker compose up
```

The container serves the same static build through Nginx on port `8080`.
