import { HashRouter, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PersonFormPage from './pages/PersonFormPage';
import PersonDetailPage from './pages/PersonDetailPage';
import SettingsPage from './pages/SettingsPage';
import PrivacyPage from './pages/PrivacyPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/new" element={<PersonFormPage />} />
        <Route path="/person/:id" element={<PersonDetailPage />} />
        <Route path="/person/:id/edit" element={<PersonFormPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
      </Routes>
    </HashRouter>
  );
}
