import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProtectedRoute from "./routes/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route
          path="/projects"
          element={
            <main className="flex min-h-screen items-center justify-center">
              <div className="text-center">
                <h1 className="text-3xl font-semibold tracking-tight">
                  CodeAlpha
                </h1>
                <p className="mt-2 text-muted-foreground">
                  Projects arrive in Phase 2.
                </p>
              </div>
            </main>
          }
        />
      </Route>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
