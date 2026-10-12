import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PersonFormPage from './pages/PersonFormPage';
import PersonDetailPage from './pages/PersonDetailPage';
import SettingsPage from './pages/SettingsPage';
import PrivacyPage from './pages/PrivacyPage';
import ProgressPage from './pages/ProgressPage';
import TasksPage from './pages/TasksPage';
import TaskSettingsPage from './pages/TaskSettingsPage';
import AuthGate from './cloud/AuthGate';
import { useRole } from './hooks/useRole';

function AppRoutes() {
  const { limited } = useRole();

  // 技術端（只屬於 tech 群組）只能進產品進度，其他網址一律導回去
  if (limited) {
    return (
      <Routes>
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="*" element={<Navigate to="/progress" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {/* 舊的「合作機會」頁已合併進待辦的業務開發；舊網址導回待辦 */}
      <Route path="/collab" element={<Navigate to="/tasks" replace />} />
      <Route path="/tasks" element={<TasksPage />} />
      <Route path="/tasks/settings" element={<TaskSettingsPage />} />
      <Route path="/progress" element={<ProgressPage />} />
      <Route path="/new" element={<PersonFormPage />} />
      <Route path="/person/:id" element={<PersonDetailPage />} />
      <Route path="/person/:id/edit" element={<PersonFormPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthGate>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthGate>
  );
}
