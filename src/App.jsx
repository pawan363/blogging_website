import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useState, useEffect } from "react";
import { Navigate } from "react-router-dom";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { AuthProvider, useAuth } from "./AuthContext";
import './index.css';

const CreateBlog = lazy(() => import("./pages/CreateBlog"));
const DisplayBlogs = lazy(() => import("./pages/DisplayBlogs"));
const SingleBlog = lazy(() => import("./pages/SingleBlog"));
const MyBlogs = lazy(() => import("./pages/MyBlogs"));
const EditBlog = lazy(() => import("./pages/EditBlog"));
const AuthPage = lazy(() => import("./pages/AuthPage"));

function RequireAuth({ children }) {
  const { user, isLoading, authError } = useAuth();
  const location = useLocation();

  if (isLoading) return <div className="empty-state">Checking your account…</div>;
  if (authError) return <div className="auth-error auth-service-error" role="alert">{authError}</div>;
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return children;
}

// A separate component to handle the routing logic
function AnimatedRoutes() {
  const location = useLocation();

  // 1. Assign a numerical order to your pages to determine left/right
  const getRouteIndex = (path) => {
    if (path === "/") return 1;
    if (path === "/login" || path === "/signup") return 2;
    if (path === "/my-blogs" || path.includes("/create")) return 3;
    if (path.includes("/blog") || path.includes("/edit")) return 4;
    return 0;
  };

  const [direction, setDirection] = useState(1);
  const [prevIndex, setPrevIndex] = useState(getRouteIndex(location.pathname));

  // 2. Check if the user is moving forward (1) or backward (-1)
  useEffect(() => {
    const currentIndex = getRouteIndex(location.pathname);
    setDirection(currentIndex > prevIndex ? 1 : -1);
    setPrevIndex(currentIndex);
  }, [location.pathname]);

  // 3. Define the swipe animation variants
  const swipeVariants = {
    initial: (dir) => ({ 
      x: dir > 0 ? 150 : -150, // Start slightly off-screen left or right
      opacity: 0 
    }),
    animate: { 
      x: 0, 
      opacity: 1,
      transition: { type: "tween", ease: "anticipate", duration: 0.4 }
    },
    exit: (dir) => ({ 
      x: dir > 0 ? -150 : 150, // Exit slightly off-screen left or right
      opacity: 0,
      transition: { type: "tween", ease: "anticipate", duration: 0.3 }
    })
  };

  return (
    // AnimatePresence "waits" for the old page to slide out before sliding the new one in
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={location.pathname}
        custom={direction}
        variants={swipeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ width: "100%" }} // Prevents layout collapse during animation
      >
        <Suspense fallback={<div className="empty-state">Loading page...</div>}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<DisplayBlogs />} />
            <Route path="/blog/:id" element={<SingleBlog />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route path="/create" element={<RequireAuth><CreateBlog /></RequireAuth>} />
            <Route path="/my-blogs" element={<RequireAuth><MyBlogs /></RequireAuth>} />
            <Route path="/edit/:id" element={<RequireAuth><EditBlog /></RequireAuth>} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

// The Main App Component
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app-wrapper">
          <Navbar />
          <div className="container main-content">
            <AnimatedRoutes />
          </div>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;