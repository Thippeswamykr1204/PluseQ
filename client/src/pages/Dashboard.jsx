import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Users, Activity as ActivityIcon, ChevronRight, ClipboardList,
  Clock, CheckCircle2, LayoutGrid, UserPlus, PhoneCall, XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";
import Navbar from "../components/Navbar.jsx";
import Modal from "../components/Modal.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { SkeletonCard } from "../components/Skeleton.jsx";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const formatMs = (ms) => {
  if (!ms) return "0m";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const timeAgo = (dateStr) => {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
};

const HEALTH_STYLES = {
  normal: { dot: "bg-emerald-400", label: "Normal", text: "text-emerald-400" },
  busy: { dot: "bg-amber-400", label: "Busy", text: "text-amber-400" },
  critical: { dot: "bg-red-400", label: "Critical", text: "text-red-400" },
};

const ACTIVITY_ICON = {
  added: { icon: UserPlus, cls: "bg-brand-500/10 text-brand-400" },
  serving: { icon: PhoneCall, cls: "bg-amber-500/10 text-amber-400" },
  served: { icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-400" },
  cancelled: { icon: XCircle, cls: "bg-red-500/10 text-red-400" },
};

const SummaryCard = ({ icon: Icon, label, value, accent }) => {
  const accentMap = {
    brand: "bg-brand-500/10 text-brand-400",
    amber: "bg-amber-500/10 text-amber-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
  };
  return (
    <div className="card p-4 flex items-center gap-3 hover:border-brand-500/25">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${accentMap[accent]}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-slate-50 leading-tight">{value}</p>
        <p className="text-xs text-slate-400 truncate">{label}</p>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { manager } = useAuth();
  const [queues, setQueues] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const socketRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const [qRes, sRes, aRes] = await Promise.all([
        api.get("/queues"),
        api.get("/analytics/today"),
        api.get("/analytics/activity"),
      ]);
      setQueues(qRes.data.data);
      setSummary(sRes.data.data);
      setActivity(aRes.data.data);
    } catch (err) {
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    if (!manager?.id) return;

    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;
    socket.emit("manager:join", manager.id);

    // New activity pushes straight into the feed; queue cards (waiting
    // counts, health) refresh via a lightweight refetch since those are
    // aggregate counts rather than a single new row to prepend.
    socket.on("activity:new", (item) => {
      setActivity((prev) => [item, ...prev].slice(0, 15));
      api.get("/queues").then((res) => setQueues(res.data.data)).catch(() => {});
      api.get("/analytics/today").then((res) => setSummary(res.data.data)).catch(() => {});
    });

    return () => {
      socket.emit("manager:leave", manager.id);
      socket.disconnect();
    };
  }, [manager?.id, fetchAll]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      toast.error("Queue name must be at least 2 characters");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/queues", form);
      toast.success("Queue created");
      setModalOpen(false);
      setForm({ name: "", description: "" });
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create queue");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-50 tracking-tight">Queues</h1>
            <p className="text-sm text-slate-400 mt-1">Manage all your active service queues</p>
          </div>
          <button onClick={() => setModalOpen(true)} className="btn-primary">
            <Plus size={16} /> New Queue
          </button>
        </div>

        {/* Today's summary strip */}
        {!loading && summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <SummaryCard icon={Users} label="Patients today" value={summary.patientsToday} accent="brand" />
            <SummaryCard icon={Clock} label="Avg wait today" value={formatMs(summary.avgWaitTodayMs)} accent="amber" />
            <SummaryCard icon={CheckCircle2} label="Served today" value={summary.servedToday} accent="emerald" />
            <SummaryCard icon={LayoutGrid} label="Active queues" value={summary.activeQueues} accent="brand" />
          </div>
        )}

        {/* Queue cards — full width now that activity has moved below */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : queues.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No queues yet"
            description="Create your first queue to start managing patients and tokens."
            action={
              <button onClick={() => setModalOpen(true)} className="btn-primary">
                <Plus size={16} /> Create Queue
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {queues.map((q, i) => {
              const health = HEALTH_STYLES[q.health] || HEALTH_STYLES.normal;
              return (
                <motion.button
                  key={q._id}
                  onClick={() => navigate(`/queues/${q._id}`)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2, delay: i * 0.04 }}
                  className="card p-5 text-left transition-all duration-200 hover:border-brand-500/40 hover:shadow-glow group"
                >
                  <div className="flex items-start justify-between">
                    <div className="h-10 w-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                      <ActivityIcon size={18} />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${health.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${health.dot} transition-transform duration-200 group-hover:scale-125`} />
                        {health.label}
                      </span>
                      <ChevronRight size={16} className="text-slate-600 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all duration-200" />
                    </div>
                  </div>
                  <h3 className="text-slate-100 font-semibold mt-4 truncate">{q.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{q.description || "No description"}</p>
                  <div className="flex items-center gap-4 mt-4 pt-4 border-t border-surface-border">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Users size={13} /> {q.waitingCount} waiting
                    </div>
                    {q.servingCount > 0 && <span className="badge-serving">Serving now</span>}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Live activity feed — full width below the queue grid */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Live activity</h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-14 w-full" />)}
            </div>
          ) : activity.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No activity yet. Add a patient to get started.</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto">
              <AnimatePresence initial={false}>
                {activity.map((item) => {
                  const cfg = ACTIVITY_ICON[item.type] || ACTIVITY_ICON.added;
                  const Icon = cfg.icon;
                  return (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-start gap-3 p-3 rounded-xl border border-transparent transition-colors duration-200 hover:border-surface-border hover:bg-white/[0.02]"
                    >
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${cfg.cls}`}>
                        <Icon size={13} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-200 leading-snug">{item.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.queueName} · {timeAgo(item.timestamp)}</p>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </main>

      <Modal open={modalOpen} title="Create new queue" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Queue name</label>
            <input
              autoFocus
              className="input"
              placeholder="e.g. General OPD"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Cardiology outpatient consultations"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? "Creating..." : "Create Queue"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
