import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./dashboard.css";

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.name?.trim().split(/\s+/)[0] || "there";

  return (
    <div className="dashboard-main">
      <section className="dashboard-welcome">
        <p className="eyebrow">Your space, your people</p>
        <h1>Welcome to your community, {firstName}.</h1>
        <p>
          A place to connect, share ideas, and keep up with the groups you
          care about.
        </p>
      </section>

      <section className="dashboard-member-card" aria-labelledby="member-heading">
        <span className="dashboard-avatar" aria-hidden="true">
          {user?.avatar ? <img src={user.avatar} alt="" /> : "CL"}
        </span>
        <div>
          <p className="eyebrow">Member profile</p>
          <h2 id="member-heading">{user?.name || "CommunityLink member"}</h2>
          <p className="dashboard-member-meta">
            {user?.bio || "Welcome to your CommunityLink profile."}
          </p>
        </div>
      </section>

      <section className="dashboard-updates" aria-labelledby="updates-heading">
        <p className="eyebrow">Community updates</p>
        <h2 id="updates-heading">Your feed starts here</h2>
        <div className="dashboard-feed-empty">
          <p>
            Join a conversation or explore a community to see what everyone
            is sharing.
          </p>
          <Link to="/communities">Explore communities</Link>
        </div>
      </section>
    </div>
  );
}
