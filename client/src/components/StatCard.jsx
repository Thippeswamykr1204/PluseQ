import { motion } from "framer-motion";
import CountUp from "./CountUp.jsx";

export default function StatCard({ icon: Icon, label, value, suffix = "", accent = "brand", trend }) {
  const accentMap = {
    brand: "bg-brand-500/10 text-brand-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    amber: "bg-amber-500/10 text-amber-400",
    red: "bg-red-500/10 text-red-400",
  };
  return (
    <motion.div
      className="card p-5"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${accentMap[accent]}`}>
          <Icon size={17} />
        </div>
        {trend != null && (
          <span className={`text-xs font-medium ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {trend >= 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-50 tracking-tight">
        <CountUp value={value} />{suffix}
      </p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </motion.div>
  );
}
