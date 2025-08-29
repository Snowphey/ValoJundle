import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css'
import ClassicPage from './ClassicPage';
import CitationPage from './CitationPage';
import ImagePage from './ImagePage';
import MainLayout from './MainLayout';
import { WonModesProvider } from './context/WonModesContext';
import { VJLDataProvider } from './context/VJLDataContext';
import EmojiPage from './EmojiPage';
import HardcorePage from './HardcorePage';
import SplashPage from './SplashPage';
import OeilPage from './OeilPage';

createRoot(document.getElementById('root')!).render(
  <VJLDataProvider>
    <WonModesProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route path="classic" element={<ClassicPage />} />
            <Route path="citation" element={<CitationPage hardcore={false} />} />
            <Route path="image" element={<ImagePage hardcore={false} />} />
            <Route path="emoji" element={<EmojiPage hardcore={false} />} />
            <Route path="splash" element={<SplashPage hardcore={false} />} />
            <Route path="oeil" element={<OeilPage hardcore={false} />} />
            <Route path="hardcore" element={<HardcorePage />} />
            <Route index element={<Navigate to="/classic" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </WonModesProvider>
  </VJLDataProvider>,
)
