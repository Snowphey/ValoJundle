import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css'
import ClassicPage from './ClassicPage';
import CitationPage from './CitationPage';
import VJLMainLayout from './VJLMainLayout';
import { WonModesProvider } from './WonModesContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WonModesProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<VJLMainLayout />}>
            <Route path="classic" element={<ClassicPage />} />
            <Route path="citation" element={<CitationPage />} />
            <Route index element={<Navigate to="/classic" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </WonModesProvider>
  </StrictMode>,
)
