import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css'
import ClassicPage from './ClassicPage';
import CitationPage from './CitationPage';
import ImagePage from './ImagePage';
import MainLayout from './MainLayout';
import { WonModesProvider } from './WonModesContext';
import EmojiPage from './EmojiPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WonModesProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route path="classic" element={<ClassicPage />} />
            <Route path="citation" element={<CitationPage />} />
            <Route path="image" element={<ImagePage />} />
            <Route path="emoji" element={<EmojiPage />} />
            <Route index element={<Navigate to="/classic" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </WonModesProvider>
  </StrictMode>,
)
