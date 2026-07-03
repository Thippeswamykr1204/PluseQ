import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "./Navbar.jsx";

// Full-page spinner, not a skeleton: at this point we don't yet know which
// page is loading, so there's no layout shape to skeleton-match. Skeletons
// are used inside each page once its own shape is known.
const RouteFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div
      className="h-8 w-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"
      role="status"
      aria-label="Loading page"
    />
  </div>
);

// Navbar lives here, outside the animated region, so it stays put while
// navigating — only the page content below it fades/slides between routes.
export default function Layout() {
  const location = useLocation();
  return (
    <div className="min-h-screen">
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
