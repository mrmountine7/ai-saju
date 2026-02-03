import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from '@/app/components/LandingPage';
import { StoragePage } from '@/app/components/StoragePage';
import { AddPage } from '@/app/components/AddPage';
import { ResultPage } from '@/app/components/ResultPage';
import { CompatibilityPage } from '@/app/components/CompatibilityPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/storage" element={<StoragePage />} />
        <Route path="/add" element={<AddPage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/compatibility" element={<CompatibilityPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
