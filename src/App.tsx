import { HashRouter, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PersonFormPage from './pages/PersonFormPage';
import PersonDetailPage from './pages/PersonDetailPage';
import SettingsPage from './pages/SettingsPage';
import PrivacyPage from './pages/PrivacyPage';
import CollabPage from './pages/CollabPage';
import TasksPage from './pages/TasksPage';
import TaskSettingsPage from './pages/TaskSettingsPage';
import AuthGate from './cloud/AuthGate';

export default function App() {
  return (
    <AuthGate>
      <HashRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/collab" element={<CollabPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/settings" element={<TaskSettingsPage />} />
          <Route path="/new" element={<PersonFormPage />} />
          <Route path="/person/:id" element={<PersonDetailPage />} />
          <Route path="/person/:id/edit" element={<PersonFormPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
        </Routes>
      </HashRouter>
    </AuthGate>
  );
}
