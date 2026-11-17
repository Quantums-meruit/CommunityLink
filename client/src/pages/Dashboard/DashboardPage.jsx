import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useEffect, useState } from "react";
import api from "../../services/api";

// The dashboard is the authenticated landing page. It combines a few
// independent API requests into one compact overview: recent notifications and
// the user's submitted opportunities/applications.
const unwrapData = (response) => response?.data?.data ?? response?.data ?? {};

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    notifications: [],
    applications: [],
  });

  useEffect(() => {
    // Both requests are intentionally independent: if one fails, the other
    // still loads and the page shows whatever data is available instead of
    // crashing the whole dashboard.
    Promise.allSettled([api.get("/notifications"), api.get("/applications/me")]).then(
      ([notificationsResult, applicationsResult]) => {
        const notificationsPayload = notificationsResult.status === "fulfilled"
          ? unwrapData(notificationsResult.value)
          : {};

        const applicationsPayload = applicationsResult.status === "fulfilled"
          ? unwrapData(applicationsResult.value)
          : {};

        setStats({
          notifications: Array.isArray(notificationsPayload.notifications)
            ? notificationsPayload.notifications
            : [],
          applications: Array.isArray(applicationsPayload.applications)
            ? applicationsPayload.applications
            : [],
        });
      }
    );
  }, []);

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR SPACE</p>
          <h1>Welcome, {user?.name?.split(" ")[0]}.</h1>
          <p>Here's what's happening across your CommunityLink account.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <Link to="/communities" className="dashboard-tile">
          <span>01 / DISCOVER</span>
          <h2>Communities</h2>
          <p>Find and join groups that matter to you.</p>
        </Link>

        <Link to="/events" className="dashboard-tile">
          <span>02 / PARTICIPATE</span>
          <h2>Events</h2>
          <p>Explore upcoming community activities.</p>
        </Link>

        <Link to="/opportunities" className="dashboard-tile">
          <span>03 / GROW</span>
          <h2>Opportunities</h2>
          <p>Find something worth applying for.</p>
        </Link>

        <Link to="/businesses" className="dashboard-tile">
          <span>04 / SUPPORT</span>
          <h2>Businesses</h2>
          <p>Discover local services and businesses.</p>
        </Link>
      </div>

      <div className="dashboard-lower">
        <div className="panel">
          <h2>Recent notifications</h2>
          {stats.notifications.length ? (
            stats.notifications.slice(0, 5).map((n) => (
              <p key={n._id}>{n.message}</p>
            ))
          ) : (
            <p>No notifications yet.</p>
          )}
          <Link to="/notifications">View all notifications →</Link>
        </div>

        <div className="panel">
          <h2>Your applications</h2>
          {stats.applications.length ? (
            stats.applications.slice(0, 5).map((a) => (
              <p key={a._id}>
                {a.opportunity?.title} — <strong>{a.status}</strong>
              </p>
            ))
          ) : (
            <p>You haven't submitted any applications yet.</p>
          )}
          <Link to="/applications">View applications →</Link>
        </div>
      </div>
    </section>
  );
}
