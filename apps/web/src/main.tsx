// Point d'entrée React TVNest avec fournisseur de thème Noir Absolu OLED par défaut.
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
