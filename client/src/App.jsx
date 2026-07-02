import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import QueueDetail from "./pages/QueueDetail.jsx";
import Analytics from "./pages/Analytics.jsx";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#111726",
              color: "#f1f5f9",
              border: "1px solid #1f2937",
              fontSize: "13px",
            },
            success: { iconTheme: { primary: "#34d399", secondary: "#111726" } },
            error: { iconTheme: { primary: "#f87171", secondary: "#111726" } },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/queues/:id" element={<QueueDetail />} />
            <Route path="/analytics" element={<Analytics />} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
