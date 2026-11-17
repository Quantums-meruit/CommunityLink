import { useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEffect, useState } from "react";
import api from "../services/api";
import ResourceList from "../components/common/ResourceList";
import ResourceForm from "../components/forms/ResourceForm";
import { ErrorMessage, Loading } from "../components/common/Feedback";

// This module centralizes the generic CRUD/list patterns for the app's content
// types. Each exported page component provides a resource-specific configuration,
// but all of them share the same list/detail/form behavior and backend contract.
const unwrapData = (response) =>
  response?.data?.data ?? response?.data ?? {};

export function Communities() {
  return (
    <ResourceList
      title="Communities"
      endpoint="/communities"
      type="communities"
      description="Find a group where you can belong, contribute and grow."
      createPath="/communities/create"
    />
  );
}

export function Events() {
  return (
    <ResourceList
      title="Events"
      endpoint="/events"
      type="events"
      description="Discover activities and experiences happening across your communities."
      createPath="/events/create"
    />
  );
}

export function Businesses() {
  return (
    <ResourceList
      title="Businesses"
      endpoint="/businesses"
      type="businesses"
      description="Explore businesses and services shared by the community."
      createPath="/businesses/create"
    />
  );
}

export function Opportunities() {
  return (
    <ResourceList
      title="Opportunities"
      endpoint="/opportunities"
      type="opportunities"
      description="Find opportunities to learn, contribute and move forward."
      createPath="/opportunities/create"
    />
  );
}

export function CreateCommunity() {
  return (
    <ResourceForm
      title="Create a community"
      endpoint="/communities"
      fields={[
        { name: "name", label: "Community name" },
        {
          name: "description",
          label: "Description",
          type: "textarea",
        },
        { name: "category", label: "Category" },
        {
          name: "visibility",
          label: "Visibility (public or private)",
          required: false,
        },
      ]}
    />
  );
}

export function CreateEvent() {
  return (
    <ResourceForm
      title="Create an event"
      endpoint="/communities/:communityId/events"
      fields={[
        { name: "communityId", label: "Community ID" },
        { name: "title", label: "Event title" },
        {
          name: "description",
          label: "Description",
          type: "textarea",
        },
        { name: "startsAt", label: "Starts at", type: "datetime-local" },
        { name: "endsAt", label: "Ends at", type: "datetime-local" },
        {
          name: "capacity",
          label: "Capacity",
          type: "number",
          required: false,
        },
        { name: "venue", label: "Venue", required: false },
      ]}
    />
  );
}

export function CreateBusiness() {
  return (
    <ResourceForm
      title="Submit a business listing"
      endpoint="/businesses"
      fields={[
        { name: "name", label: "Business name" },
        {
          name: "description",
          label: "Description",
          type: "textarea",
        },
        { name: "category", label: "Category" },
        { name: "location", label: "Location", required: false },
        {
          name: "contactEmail",
          label: "Contact email",
          type: "email",
          required: false,
        },
        { name: "phone", label: "Phone", required: false },
        { name: "website", label: "Website URL", required: false },
      ]}
    />
  );
}

export function CreateOpportunity() {
  return (
    <ResourceForm
      title="Publish an opportunity"
      endpoint="/opportunities"
      fields={[
        { name: "title", label: "Opportunity title" },
        {
          name: "description",
          label: "Description",
          type: "textarea",
        },
        { name: "category", label: "Category" },
        { name: "organization", label: "Organization", required: false },
        { name: "deadline", label: "Deadline", type: "date", required: false },
        {
          name: "applicationInstructions",
          label: "Application instructions",
          type: "textarea",
          required: false,
        },
      ]}
    />
  );
}

// Detail is the reusable page shell for a single resource entity. It loads the
// record by id, unwraps the response envelope, and then renders the correct
// action buttons depending on whether the resource is a community, event, or
// opportunity.
function Detail({ resource, endpoint }) {
  const { id } = useParams();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await api.get(`${endpoint}/${id}`);
        const payload = unwrapData(response);
        const nextItem =
          payload[resource] ||
          payload.item ||
          payload.community ||
          payload.event ||
          payload.business ||
          payload.opportunity ||
          null;

        setItem(nextItem);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, endpoint, resource]);

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  if (!item) {
    return <ErrorMessage>Unable to load this item.</ErrorMessage>;
  }

  return (
    <>
      <article className="detail-panel">
        <p className="eyebrow">COMMUNITYLINK / {resource.toUpperCase()}</p>
        <h1>{item.name || item.title}</h1>
        <p className="detail-description">{item.description || item.content}</p>
        <div className="detail-meta">
          {item.category || item.venue || item.organization || "CommunityLink"}
          {item.location ? ` · ${item.location}` : ""}
        </div>

        {resource === "community" && user && <JoinButton id={id} />}
        {resource === "event" && user && <RegisterButton id={id} />}
        {resource === "opportunity" && user && <ApplyButton id={id} />}
      </article>

      {resource === "community" && <CommunityFeed id={id} />}
    </>
  );
}

function CommunityFeed({ id }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const response = await api.get(`/communities/${id}/posts`);
      const payload = unwrapData(response);
      setPosts(Array.isArray(payload.items) ? payload.items : []);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    refresh();
  }, [id]);

  async function publish(e) {
    e.preventDefault();

    try {
      await api.post(`/communities/${id}/posts`, { content });
      setContent("");
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="feed-section">
      <h2>Community feed</h2>

      {user ? (
        <form onSubmit={publish} className="post-composer">
          <textarea
            rows="3"
            required
            placeholder="Share something with this community…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <button className="button button-primary">Publish post</button>
        </form>
      ) : (
        <p>
          <Link to="/login">Sign in</Link> to publish posts and comments.
        </p>
      )}

      <ErrorMessage>{error}</ErrorMessage>

      {posts.map((post) => (
        <PostItem key={post._id} post={post} />
      ))}
    </section>
  );
}

function PostItem({ post }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api
      .get(`/posts/${post._id}/comments`)
      .then((response) => {
        const payload = unwrapData(response);
        setComments(Array.isArray(payload.comments) ? payload.comments : []);
      })
      .catch(() => {});
  }, [post._id]);

  async function comment(e) {
    e.preventDefault();

    try {
      await api.post(`/posts/${post._id}/comments`, { content: draft });
      setDraft("");

      const response = await api.get(`/posts/${post._id}/comments`);
      const payload = unwrapData(response);
      setComments(Array.isArray(payload.comments) ? payload.comments : []);
    } catch (e) {
      setMessage(e.message);
    }
  }

  async function report() {
    try {
      await api.post(`/posts/${post._id}/reports`, {
        reason: "Reported by community member",
      });
      setMessage("Report submitted.");
    } catch (e) {
      setMessage(e.message);
    }
  }

  return (
    <article className="feed-post">
      <p className="post-author">{post.author?.name || "Community member"}</p>
      <p>{post.content}</p>

      {user && (
        <button className="button button-quiet" onClick={report}>
          Report post
        </button>
      )}

      {user && (
        <form onSubmit={comment} className="comment-form">
          <input
            required
            placeholder="Write a comment…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="button button-dark">Comment</button>
        </form>
      )}

      {message && <p>{message}</p>}

      {comments.map((commentItem) => (
        <p className="comment" key={commentItem._id}>
          <strong>{commentItem.author?.name || "Member"}:</strong>{" "}
          {commentItem.content}
        </p>
      ))}
    </article>
  );
}

function JoinButton({ id }) {
  const [msg, setMsg] = useState("");

  return (
    <div>
      <button
        className="button button-primary"
        onClick={() =>
          api
            .post(`/communities/${id}/join`)
            .then((response) => {
              const payload = unwrapData(response);
              const status = payload.membership?.status || "active";
              setMsg(
                status === "pending"
                  ? "Request sent for approval."
                  : "You joined this community."
              );
            })
            .catch((e) => setMsg(e.message))
        }
      >
        Join community
      </button>
      {msg && <p>{msg}</p>}
    </div>
  );
}

function RegisterButton({ id }) {
  const [msg, setMsg] = useState("");

  return (
    <div>
      <button
        className="button button-primary"
        onClick={() =>
          api
            .post(`/events/${id}/register`)
            .then(() => setMsg("You are registered."))
            .catch((e) => setMsg(e.message))
        }
      >
        Register for event
      </button>
      {msg && <p>{msg}</p>}
    </div>
  );
}

function ApplyButton({ id }) {
  const [msg, setMsg] = useState("");

  return (
    <div>
      <button
        className="button button-primary"
        onClick={() =>
          api
            .post(`/opportunities/${id}/applications`, {
              message: "I would like to apply.",
            })
            .then(() => setMsg("Application submitted."))
            .catch((e) => setMsg(e.message))
        }
      >
        Apply now
      </button>
      {msg && <p>{msg}</p>}
    </div>
  );
}

export function CommunityDetail() {
  return <Detail resource="community" endpoint="/communities" />;
}

export function EventDetail() {
  return <Detail resource="event" endpoint="/events" />;
}

export function BusinessDetail() {
  return <Detail resource="business" endpoint="/businesses" />;
}

export function OpportunityDetail() {
  return <Detail resource="opportunity" endpoint="/opportunities" />;
}

export function Applications() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api
      .get("/applications/me")
      .then((response) => {
        const payload = unwrapData(response);
        setItems(Array.isArray(payload.applications) ? payload.applications : []);
      })
      .catch(() => {});
  }, []);

  return (
    <section>
      <h1>My applications</h1>
      {items.map((application) => (
        <article className="list-row" key={application._id}>
          <strong>{application.opportunity?.title}</strong>
          <span>{application.status}</span>
        </article>
      ))}
    </section>
  );
}

export function Notifications() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api
      .get("/notifications")
      .then((response) => {
        const payload = unwrapData(response);
        setItems(Array.isArray(payload.notifications) ? payload.notifications : []);
      })
      .catch(() => {});
  }, []);

  return (
    <section>
      <h1>Notifications</h1>
      {items.map((notification) => (
        <article className="list-row" key={notification._id}>
          <span>{notification.message}</span>
        </article>
      ))}
    </section>
  );
}

export function AdminDashboard() {
  return <section><h1>Admin dashboard</h1><p>Admin tools are available here.</p></section>;
}

export function NotFound() {
  return <section><h1>Page not found</h1><p>Sorry, this page does not exist.</p></section>;
}
