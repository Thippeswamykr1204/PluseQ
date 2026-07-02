import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

export default function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", danger = false, onConfirm, onCancel }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            className="card w-full max-w-sm p-6"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${danger ? "bg-red-500/10 text-red-400" : "bg-brand-500/10 text-brand-400"}`}>
                <AlertTriangle size={18} />
              </div>
              <button onClick={onCancel} className="btn-icon">
                <X size={16} />
              </button>
            </div>
            <h3 className="text-base font-semibold text-slate-100">{title}</h3>
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{message}</p>
            <div className="flex gap-2 mt-5">
              <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
              <button onClick={onConfirm} className={danger ? "btn-danger flex-1" : "btn-primary flex-1"}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
