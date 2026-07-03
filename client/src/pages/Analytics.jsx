import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Clock, Users, CheckCircle2, TrendingUp, BarChart3 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api/axios.js";
import StatCard from "../components/StatCard.jsx";
import { SkeletonCard } from "../components/Skeleton.jsx";
import EmptyState from "../components/EmptyState.jsx";

const COLORS = { waiting: "#94a3b8", serving: "#3b63f6", served: "#34d399", cancelled: "#f87171" };

const formatMs = (ms) => {
  if (!ms) return "0m";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function Analytics() {
  const [queues, setQueues] = useState([]);
  const [selectedId, setSelectedId] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/queues").then((res) => setQueues(res.data.data)).catch(() => {});
    api
      .get("/analytics/overview")
      .then((res) => setOverview(res.data.data))
      .catch(() => toast.error("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedId === "overview") return;
    setLoading(true);
    api
      .get(`/queues/${selectedId}/analytics`)
      .then((res) => setQueueData(res.data.data))
      .catch(() => toast.error("Failed to load queue analytics"))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const data = selectedId === "overview" ? overview : queueData;
  const statusBreakdown = data?.statusBreakdown || { waiting: 0, serving: 0, served: 0, cancelled: 0 };
  const pieData = Object.entries(statusBreakdown)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k, value: v }));

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-50 tracking-tight">Analytics</h1>
            <p className="text-sm text-slate-400 mt-1">Wait times, throughput, and queue trends</p>
          </div>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="input w-full sm:w-56"
          >
            <option value="overview">All queues (overview)</option>
            {queues.map((q) => (
              <option key={q._id} value={q._id}>{q.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : !data || (selectedId === "overview" && data.totalQueues === 0) ? (
          <EmptyState icon={BarChart3} title="No data yet" description="Create a queue and add patients to see analytics." />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard
                icon={Users}
                label={selectedId === "overview" ? "Total patients" : "Total tokens"}
                value={selectedId === "overview"
                  ? Object.values(statusBreakdown).reduce((a, b) => a + b, 0)
                  : data.totalPatients || 0}
                accent="brand"
              />
              <div className="card p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-400">
                    <Clock size={17} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-50 tracking-tight">{formatMs(data.avgWaitTimeMs)}</p>
                <p className="text-xs text-slate-400 mt-1">Avg wait time</p>
              </div>
              <StatCard icon={CheckCircle2} label="Patients served" value={statusBreakdown.served} accent="emerald" />
              <StatCard icon={TrendingUp} label="Currently waiting" value={statusBreakdown.waiting} accent="brand" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Status breakdown pie */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Status breakdown</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3} animationDuration={700} animationEasing="ease-out">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={COLORS[entry.name] || "#94a3b8"} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 justify-center mt-2">
                  {pieData.map((p) => (
                    <div key={p.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="h-2 w-2 rounded-full" style={{ background: COLORS[p.name] }} />
                      {p.name} ({p.value})
                    </div>
                  ))}
                </div>
              </div>

              {/* Queue length trend (per-queue only) */}
              {selectedId !== "overview" && data.trend && (
                <div className="card p-5 lg:col-span-2">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4">Queue trend (last 14 days)</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={data.trend}>
                      <defs>
                        <linearGradient id="addedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b63f6" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#3b63f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="_id" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#3b63f6", strokeWidth: 1, strokeDasharray: "3 3" }} />
                      <Area type="monotone" dataKey="added" name="Added" stroke="#3b63f6" fill="url(#addedGrad)" strokeWidth={2} animationDuration={800} animationEasing="ease-out" />
                      <Line type="monotone" dataKey="served" name="Served" stroke="#34d399" strokeWidth={2} dot={false} animationDuration={800} animationEasing="ease-out" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Per-queue comparison (overview only) */}
              {selectedId === "overview" && data.perQueue && (
                <div className="card p-5 lg:col-span-2">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4">Patients per queue</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.perQueue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="queueName" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(59,99,246,0.08)" }} />
                      <Bar dataKey="total" name="Total" fill="#3b63f6" radius={[6, 6, 0, 0]} className="transition-opacity duration-150" animationDuration={700} animationEasing="ease-out" />
                      <Bar dataKey="served" name="Served" fill="#34d399" radius={[6, 6, 0, 0]} className="transition-opacity duration-150" animationDuration={700} animationEasing="ease-out" animationBegin={100} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Hourly distribution (per-queue only) */}
              {selectedId !== "overview" && data.hourlyDistribution && (
                <div className="card p-5 lg:col-span-3">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4">Peak hours (patients added by hour of day)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.hourlyDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                      <XAxis dataKey="_id" tickFormatter={(h) => `${h}:00`} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(59,99,246,0.08)" }} />
                      <Bar dataKey="count" name="Patients" fill="#3b63f6" radius={[6, 6, 0, 0]} className="transition-opacity duration-150" animationDuration={700} animationEasing="ease-out" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
