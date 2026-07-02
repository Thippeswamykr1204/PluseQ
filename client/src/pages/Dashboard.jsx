import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Users, Activity as ActivityIcon, ChevronRight, ClipboardList } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api/axios.js";
import Navbar from "../components/Navbar.jsx";
import Modal from "../components/Modal.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { SkeletonCard } from "../components/Skeleton.jsx";

export default function Dashboard() {
  const navigate = useNavigate();
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchQueues = async () => {
    try {
      const res = await api.get("/queues");
      setQueues(res.data.data);
    } catch (err) {
      toast.error("Failed to load queues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueues();
  }, []);

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
      fetchQueues();
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

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {queues.map((q, i) => (
              <motion.button
                key={q._id}
                onClick={() => navigate(`/queues/${q._id}`)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
                className="card p-5 text-left hover:border-brand-500/40 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
                    <ActivityIcon size={18} />
                  </div>
                  <ChevronRight size={16} className="text-slate-600 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all mt-2" />
                </div>
                <h3 className="text-slate-100 font-semibold mt-4 truncate">{q.name}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{q.description || "No description"}</p>
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-surface-border">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Users size={13} /> {q.waitingCount} waiting
                  </div>
                  {q.servingCount > 0 && (
                    <span className="badge-serving">Serving now</span>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        )}
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
