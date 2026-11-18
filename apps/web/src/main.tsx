// Point d'entrée React TVNest avec polices embarquées localement et thème initialisé hors-ligne.
import './lib/theme-boot';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/plus-jakarta-sans';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@/lib/theme';
import { App } from './App';
import './styles/globals.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>
  );
}
