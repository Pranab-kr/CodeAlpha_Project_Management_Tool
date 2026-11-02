import { Navigate, Route, Routes } from "react-router-dom";
import { AppShellLayout } from "./components/layout/AppShell";
import BoardPage from "./features/board/BoardPage";
import { SocketProvider } from "./features/realtime/SocketProvider";
import LoginPage from "./pages/LoginPage";
import ProjectSettingsPage from "./pages/ProjectSettingsPage";
import ProjectsPage from "./pages/ProjectsPage";
import RegisterPage from "./pages/RegisterPage";
import ProtectedRoute from "./routes/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route
          element={
            <SocketProvider>
              <AppShellLayout />
            </SocketProvider>
          }
        >
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<BoardPage />} />
          <Route
            path="/projects/:projectId/settings"
            element={<ProjectSettingsPage />}
          />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
