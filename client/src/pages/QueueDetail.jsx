import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, ChevronUp, ChevronDown, PhoneCall, CheckCircle2,
  XCircle, Clock, Users, Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import api from "../api/axios.js";
import Navbar from "../components/Navbar.jsx";
import Modal from "../components/Modal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { SkeletonRow } from "../components/Skeleton.jsx";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const StatusBadge = ({ status }) => {
  const map = {
    waiting: { cls: "badge-waiting", label: "Waiting" },
    serving: { cls: "badge-serving", label: "Serving" },
    served: { cls: "badge-served", label: "Served" },
    cancelled: { cls: "badge-cancelled", label: "Cancelled" },
  };
  const s = map[status] || map.waiting;
  return <span className={s.cls}>{s.label}</span>;
};

export default function QueueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [queue, setQueue] = useState(null);
  const [tokens, setTokens] = useState({ waiting: [], serving: [], served: [] });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ patientName: "", phone: "", priority: false });
  const [submitting, setSubmitting] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [busyTokenId, setBusyTokenId] = useState(null);
  const socketRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const [qRes, tRes] = await Promise.all([
        api.get(`/queues/${id}`),
        api.get(`/queues/${id}/tokens`),
      ]);
      setQueue(qRes.data.data);
      setTokens(tRes.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load queue");
      if (err.response?.status === 404) navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchAll();

    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    socketRef.current = socket;
    socket.emit("queue:join", id);
    socket.on("queue:updated", () => fetchAll());

    return () => {
      socket.emit("queue:leave", id);
      socket.disconnect();
    };
  }, [id, fetchAll]);

  const handleAddToken = async (e) => {
    e.preventDefault();
    if (form.patientName.trim().length < 2) {
      toast.error("Patient name must be at least 2 characters");
      return;
    }
    if (form.phone && form.phone.length !== 10) {
      toast.error("Phone number must be exactly 10 digits");
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form, phone: form.phone ? `+91${form.phone}` : "" };
      const res = await api.post(`/queues/${id}/tokens`, payload);
      toast.success(`Token #${res.data.data.tokenNumber} added`);
      setModalOpen(false);
      setForm({ patientName: "", phone: "", priority: false });
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add patient");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMove = async (tokenId, direction) => {
    setBusyTokenId(tokenId);
    try {
      await api.patch(`/tokens/${tokenId}/move`, { direction });
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not move token");
    } finally {
      setBusyTokenId(null);
    }
  };

  const handleAssignNext = async () => {
    setBusyTokenId("assign");
    try {
      const res = await api.post(`/queues/${id}/assign-next`);
      toast.success(res.data.message);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not assign next patient");
    } finally {
      setBusyTokenId(null);
    }
  };

  const handleComplete = async (tokenId) => {
    setBusyTokenId(tokenId);
    try {
      await api.patch(`/tokens/${tokenId}/complete`);
      toast.success("Marked as served");
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not complete token");
    } finally {
      setBusyTokenId(null);
    }
  };

  const handleCancel = async () => {
    if (!confirmCancel) return;
    const tokenId = confirmCancel._id;
    setConfirmCancel(null);
    setBusyTokenId(tokenId);
    try {
      await api.delete(`/tokens/${tokenId}`);
      toast.success("Token cancelled");
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not cancel token");
    } finally {
      setBusyTokenId(null);
    }
  };

  const activelyServing = tokens.serving?.[0];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <button onClick={() => navigate("/dashboard")} className="btn-ghost -ml-3 mb-2">
          <ArrowLeft size={15} /> Back to queues
        </button>

        {loading ? (
          <div className="space-y-3 mt-4">{[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}</div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-50 tracking-tight">{queue?.name}</h1>
                <p className="text-sm text-slate-400 mt-1">{queue?.description || "No description"}</p>
              </div>
              <button onClick={() => setModalOpen(true)} className="btn-primary shrink-0">
                <Plus size={16} /> Add Patient
              </button>
            </div>

            {/* Now serving card */}
            <div className="card p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
                  <Zap size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Now serving</p>
                  {activelyServing ? (
                    <p className="text-slate-100 font-semibold">
                      #{activelyServing.tokenNumber} — {activelyServing.patientName}
                    </p>
                  ) : (
                    <p className="text-slate-500 text-sm">No one currently being served</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {activelyServing ? (
                  <button
                    onClick={() => handleComplete(activelyServing._id)}
                    disabled={busyTokenId === activelyServing._id}
                    className="btn-primary"
                  >
                    <CheckCircle2 size={16} /> Mark as Served
                  </button>
                ) : (
                  <button
                    onClick={handleAssignNext}
                    disabled={busyTokenId === "assign" || tokens.waiting.length === 0}
                    className="btn-primary"
                  >
                    <PhoneCall size={16} /> Call Next Patient
                  </button>
                )}
              </div>
            </div>

            {/* Waiting list */}
            <div className="flex items-center gap-2 mb-3">
              <Users size={15} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-300">Waiting ({tokens.waiting.length})</h2>
            </div>

            {tokens.waiting.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No patients waiting"
                description="Add a patient to the queue to get started."
              />
            ) : (
              <div className="space-y-2 mb-8">
                <AnimatePresence initial={false}>
                  {tokens.waiting.map((t, idx) => (
                    <motion.div
                      key={t._id}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className={`card p-4 flex items-center gap-4 ${idx === 0 ? "border-brand-500/30" : ""}`}
                    >
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${
                        idx === 0 ? "bg-brand-500 text-white" : "bg-surface-border text-slate-300"
                      }`}>
                        {t.tokenNumber}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-slate-100 font-medium truncate">{t.patientName}</p>
                          {t.priority && (
                            <span className="badge bg-amber-500/15 text-amber-400 shrink-0">Priority</span>
                          )}
                          {typeof t.estimatedWaitMinutes === "number" && (
                            <span className="badge bg-slate-500/10 text-slate-400 shrink-0">
                              ~{t.estimatedWaitMinutes}m est. wait
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {t.phone && `${t.phone} · `}Waiting {timeAgo(t.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleMove(t._id, "up")}
                          disabled={idx === 0 || busyTokenId === t._id}
                          className="btn-icon"
                          title="Move up"
                          aria-label={`Move ${t.patientName} up in the queue`}
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          onClick={() => handleMove(t._id, "down")}
                          disabled={idx === tokens.waiting.length - 1 || busyTokenId === t._id}
                          className="btn-icon"
                          title="Move down"
                          aria-label={`Move ${t.patientName} down in the queue`}
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button
                          onClick={() => setConfirmCancel(t)}
                          disabled={busyTokenId === t._id}
                          className="btn-icon hover:text-red-400"
                          title="Cancel token"
                          aria-label={`Cancel token for ${t.patientName}`}
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Recently served */}
            {tokens.served.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 size={15} className="text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-300">Recently served ({tokens.served.length})</h2>
                </div>
                <div className="space-y-2">
                  {tokens.served.slice(0, 5).map((t) => (
                    <div key={t._id} className="card p-3.5 flex items-center gap-4 opacity-70">
                      <div className="h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-semibold">
                        {t.tokenNumber}
                      </div>
                      <p className="text-sm text-slate-300 flex-1 truncate">{t.patientName}</p>
                      <StatusBadge status={t.status} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      <Modal open={modalOpen} title="Add patient to queue" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleAddToken} className="space-y-4">
          <div>
            <label className="label">Patient name</label>
            <input
              autoFocus
              className="input"
              placeholder="Full name"
              value={form.patientName}
              onChange={(e) => setForm({ ...form, patientName: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Phone (optional)</label>
            <div className="flex items-center input !p-0 overflow-hidden">
              <span className="px-3.5 text-sm text-slate-400 border-r border-surface-border select-none shrink-0">
                +91
              </span>
              <input
                type="tel"
                inputMode="numeric"
                className="flex-1 bg-transparent px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none"
                placeholder="98765 43210"
                maxLength={10}
                value={form.phone}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setForm({ ...form, phone: digitsOnly });
                }}
              />
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.checked })}
              className="h-4 w-4 rounded accent-brand-500"
            />
            <span className="text-sm text-slate-300">Mark as priority / emergency case</span>
          </label>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? "Adding..." : "Add to Queue"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmCancel}
        title="Cancel this token?"
        message={`This will remove ${confirmCancel?.patientName || "this patient"} (#${confirmCancel?.tokenNumber}) from the queue. This action cannot be undone.`}
        confirmLabel="Cancel Token"
        danger
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancel(null)}
      />
    </div>
  );
}
