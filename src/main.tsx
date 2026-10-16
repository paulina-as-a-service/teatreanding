import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/500.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo/800.css';
import '@fontsource/saira-condensed/500.css';
import '@fontsource/saira-condensed/600.css';
import '@fontsource/saira-condensed/700.css';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
