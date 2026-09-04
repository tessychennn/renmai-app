import { HashRouter, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PersonFormPage from './pages/PersonFormPage';
import PersonDetailPage from './pages/PersonDetailPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/new" element={<PersonFormPage />} />
        <Route path="/person/:id" element={<PersonDetailPage />} />
        <Route path="/person/:id/edit" element={<PersonFormPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </HashRouter>
  );
}
