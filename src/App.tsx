import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ClientsPage from './pages/ClientsPage';
import PersonFormPage from './pages/PersonFormPage';
import PersonDetailPage from './pages/PersonDetailPage';
import SettingsPage from './pages/SettingsPage';
import PrivacyPage from './pages/PrivacyPage';
import ProgressPage from './pages/ProgressPage';
import ProgressSettingsPage from './pages/ProgressSettingsPage';
import TasksPage from './pages/TasksPage';
import TaskSettingsPage from './pages/TaskSettingsPage';
import AuthGate from './cloud/AuthGate';
import { useRole } from './hooks/useRole';
import { homeRoute } from './lib/roles';

/** 只開放這個帳號有權限的頁面，其他網址一律導回第一個能進的頁面 */
function AppRoutes() {
  const role = useRole();
  const home = homeRoute(role);

  return (
    <Routes>
      {role.people && (
        <>
          <Route path="/" element={<HomePage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/new" element={<PersonFormPage />} />
          <Route path="/person/:id" element={<PersonDetailPage />} />
          <Route path="/person/:id/edit" element={<PersonFormPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
        </>
      )}
      {role.todo && (
        <>
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/settings" element={<TaskSettingsPage />} />
        </>
      )}
      {role.progress && (
        <>
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/progress/settings" element={<ProgressSettingsPage />} />
        </>
      )}
      {/* 舊的「合作機會」頁已經改成「客戶」；舊網址導到客戶 */}
      <Route path="/collab" element={<Navigate to={role.people ? '/clients' : home} replace />} />
      <Route path="*" element={<Navigate to={home} replace />} />
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
