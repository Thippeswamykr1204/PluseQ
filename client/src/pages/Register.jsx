import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity, Mail, Lock, User, Building2, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", hospitalName: "" });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = "Name must be at least 2 characters";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter a valid email";
    if (form.password.length < 6) e.password = "Password must be at least 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await register(form);
      toast.success("Account created");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="h-11 w-11 rounded-xl bg-brand-500 flex items-center justify-center text-white shadow-glow mb-4">
            <Activity size={22} />
          </div>
          <h1 className="text-xl font-bold text-slate-50">Create your account</h1>
          <p className="text-sm text-slate-400 mt-1">Start managing queues in minutes</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="label">Full name</label>
            <div className="relative">
              <User size={15} className="absolute left-4 pointer-events-none top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input pl-11" placeholder="Dr. Asha Rao" style={{ paddingLeft: "2.75rem" }} value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            {errors.name && <p className="text-xs text-red-400 mt-1.5">{errors.name}</p>}
          </div>

          <div>
            <label className="label">Hospital / Facility (optional)</label>
            <div className="relative">
              <Building2 size={15} className="absolute left-4 pointer-events-none top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input pl-11" placeholder="City General Hospital" style={{ paddingLeft: "2.75rem" }} value={form.hospitalName}
                onChange={(e) => setForm({ ...form, hospitalName: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail size={15} className="absolute left-4 pointer-events-none top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="email" className="input pl-11" placeholder="you@hospital.com" style={{ paddingLeft: "2.75rem" }} value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            {errors.email && <p className="text-xs text-red-400 mt-1.5">{errors.email}</p>}
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-4 pointer-events-none top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="password" className="input pl-11" placeholder="At least 6 characters" style={{ paddingLeft: "2.75rem" }} value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            {errors.password && <p className="text-xs text-red-400 mt-1.5">{errors.password}</p>}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating account..." : "Create account"}
            {!loading && <ArrowRight size={15} />}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-5">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
