import { BookOpen, LogOut, PenLine } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import "./Navbar.css";

function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out failed:", error);
      window.alert(error.response?.data?.error || "Unable to sign out. Please try again.");
    }
  };

  return (
    <header className="site-header">
      <nav className="navbar" aria-label="Main navigation">
        <Link to="/" className="brand" aria-label="Commonplace home">
          <span className="brand-mark"><BookOpen size={20} strokeWidth={2.2} /></span>
          <span className="brand-copy">
            <span className="brand-name">Commonplace</span>
            <span className="brand-caption">A journal for curious minds</span>
          </span>
        </Link>

        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " active-link" : ""}`}>
            Discover
          </NavLink>
          {user && (
            <NavLink to="/my-blogs" className={({ isActive }) => `nav-link${isActive ? " active-link" : ""}`}>
              My stories
            </NavLink>
          )}
        </div>

        {user ? (
          <div className="nav-account">
            <span className="nav-username">{user.username}</span>
            <Link to="/create" className="nav-write-button">
              <PenLine size={16} />
              <span>Write a story</span>
            </Link>
            <button type="button" className="nav-signout" onClick={handleSignOut} aria-label="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="nav-guest-actions">
            <Link to="/login?next=%2Fcreate" className="nav-signin-link">Sign in</Link>
            <Link to="/signup" className="nav-write-button">
              <PenLine size={16} />
              <span>Start writing</span>
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}

export default Navbar;
