import { Link, useNavigate, useLocation } from "react-router-dom";
import { Activity, LayoutDashboard, BarChart3, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function Navbar() {
  const { manager, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItem = (to, label, Icon) => {
    const active = location.pathname === to;
    return (
      <Link
        to={to}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          active ? "bg-brand-500/10 text-brand-300" : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
        }`}
      >
        <Icon size={16} />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-30 border-b border-surface-border bg-surface/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-brand-500 flex items-center justify-center text-white">
            <Activity size={17} />
          </div>
          <span className="font-bold text-slate-50 tracking-tight hidden sm:block">PulseQ</span>
        </div>

        <nav className="flex items-center gap-1">
          {navItem("/dashboard", "Dashboard", LayoutDashboard)}
          {navItem("/analytics", "Analytics", BarChart3)}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-sm font-medium text-slate-200">{manager?.name}</span>
            <span className="text-xs text-slate-500">{manager?.hospitalName || manager?.email}</span>
          </div>
          <div className="h-9 w-9 rounded-full bg-brand-500/15 text-brand-300 flex items-center justify-center text-sm font-semibold">
            {manager?.name?.[0]?.toUpperCase() || "M"}
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="btn-icon"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
