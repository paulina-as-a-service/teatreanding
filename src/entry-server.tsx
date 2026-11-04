/**
 * Build-time prerender entry (see scripts/prerender.mjs). Renders the landing to static HTML so search
 * engines and AI crawlers that don't run JavaScript can read the content. The browser still mounts the
 * app normally from src/main.tsx.
 */
import { renderToString } from 'react-dom/server';
import App from './App';
import { jsonLd } from './content/seo';

export function render() {
  return {
    html: renderToString(<App />),
    jsonLd: JSON.stringify(jsonLd()),
  };
}
