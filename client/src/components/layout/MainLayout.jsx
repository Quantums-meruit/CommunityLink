import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import PageMetadata from "../common/PageMetadata";

export default function MainLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [signOutError, setSignOutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    setSignOutError("");

    try {
      await logout();
      navigate("/");
    } catch (error) {
      setSignOutError(error.message);
    } finally {
      setSigningOut(false);
    }
  }

  const exploreLinks = [
    [user ? "Home feed" : "Home", user ? "/dashboard" : "/"],
    ["Discover communities", "/communities"],
    ["Events", "/events"],
    ["Businesses", "/businesses"],
    ["Opportunities", "/opportunities"],
  ];

  return (
    <div className="app-shell">
      <PageMetadata />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="app-sidebar">
        <Link className="app-sidebar-brand" to="/">
          <span className="app-sidebar-brand-mark" aria-hidden="true">
            C
          </span>
          <span>
            Community<strong>Link</strong>
          </span>
        </Link>

        <div className="app-sidebar-group">
          <p className="app-sidebar-label">Explore</p>
          <nav className="app-sidebar-nav" aria-label="Explore">
            {exploreLinks.map(([label, path], index) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/" || path === "/dashboard"}
                className={({ isActive }) =>
                  isActive ? "app-sidebar-link active" : "app-sidebar-link"
                }
              >
                <span className="app-sidebar-icon" aria-hidden="true">
                  {index === 0 ? "#" : "+"}
                </span>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="app-sidebar-group app-sidebar-communities">
          <p className="app-sidebar-label">Your communities</p>
          <p className="app-sidebar-note">
            Your joined communities will appear here.
          </p>
          <Link className="app-sidebar-text-link" to="/communities">
            Discover communities
          </Link>
        </div>

        {loading ? (
          <div className="app-sidebar-auth app-sidebar-auth-loading" aria-live="polite">
            Checking your account…
          </div>
        ) : user ? (
          <>
            <nav className="app-sidebar-account" aria-label="Your account">
              <NavLink to="/profile" className="app-sidebar-account-link">
                Profile
              </NavLink>
              <NavLink to="/applications" className="app-sidebar-account-link">
                Applications
              </NavLink>
              <NavLink to="/notifications" className="app-sidebar-account-link">
                Notifications
              </NavLink>
              {user.globalRole === "admin" && (
                <NavLink to="/admin" className="app-sidebar-account-link">
                  Admin
                </NavLink>
              )}
            </nav>
            <div className="app-sidebar-user">
              <Link className="app-sidebar-profile" to="/profile">
                <span className="app-sidebar-avatar" aria-hidden="true">
                  {user.avatar ? (
                    <img src={user.avatar} alt="" />
                  ) : (
                    user.name
                      ?.trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase()
                  )}
                </span>
                <span className="app-sidebar-profile-copy">
                  <strong>{user.name}</strong>
                  <span>{user.bio || "Your member profile"}</span>
                </span>
              </Link>
              <button
                className="app-sidebar-signout"
                type="button"
                onClick={signOut}
                disabled={signingOut}
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
              {signOutError && (
                <p className="app-sidebar-auth-error" role="alert">
                  {signOutError}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="app-sidebar-auth">
            <Link className="app-sidebar-signin" to="/login">
              Sign in
            </Link>
            <Link className="button button-primary app-sidebar-register" to="/register">
              Create account
            </Link>
          </div>
        )}

        {!user && !loading && (
          <p className="app-sidebar-tagline">
            Find your people. Share what matters.
          </p>
        )}
      </aside>

      <div className="app-main">
        <main className="main-content" id="main-content">
          <Outlet />
        </main>
        <footer className="footer">
          <span>CommunityLink</span>
          <span>Made for communities, by communities.</span>
        </footer>
      </div>
    </div>
  );
}
