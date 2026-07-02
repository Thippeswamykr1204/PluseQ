import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../api/axios.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [manager, setManager] = useState(() => {
    const raw = localStorage.getItem("pulseq_manager");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("pulseq_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => {
        setManager(res.data.data);
        localStorage.setItem("pulseq_manager", JSON.stringify(res.data.data));
      })
      .catch(() => {
        localStorage.removeItem("pulseq_token");
        localStorage.removeItem("pulseq_manager");
        setManager(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    const { token, manager } = res.data.data;
    localStorage.setItem("pulseq_token", token);
    localStorage.setItem("pulseq_manager", JSON.stringify(manager));
    setManager(manager);
  }, []);

  const register = useCallback(async (payload) => {
    const res = await api.post("/auth/register", payload);
    const { token, manager } = res.data.data;
    localStorage.setItem("pulseq_token", token);
    localStorage.setItem("pulseq_manager", JSON.stringify(manager));
    setManager(manager);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("pulseq_token");
    localStorage.removeItem("pulseq_manager");
    setManager(null);
  }, []);

  return (
    <AuthContext.Provider value={{ manager, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
