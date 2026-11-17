import { useEffect, useState } from "react";
import api from "../../services/api";
import ResourceCard from "./ResourceCard";
import { EmptyState, ErrorMessage, Loading } from "./Feedback";

// Many endpoints return the same envelope: { success: true, data: { ... } }.
// This helper makes the list pages resilient to both the wrapped API format and
// legacy direct-array responses, so the same generic component can power many
// resource types without duplication.
const unwrapData = (response) =>
  response?.data?.data ?? response?.data ?? {};

export default function ResourceList({
  title,
  endpoint,
  type,
  description,
  createPath,
  filters = true,
}) {
  // Shared list state: the component is generic enough to render communities,
  // events, businesses, opportunities, and other resource collections.
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(endpoint, {
        params: {
          page,
          limit: 9,
          ...(search ? { search } : {}),
        },
      });

      const payload = unwrapData(response);
      const nextItems = Array.isArray(payload)
        ? payload
        : payload.items ||
          payload.communities ||
          payload.businesses ||
          payload.opportunities ||
          payload.events ||
          payload.applications ||
          payload.notifications ||
          [];

      setItems(nextItems);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Re-fetch whenever the route changes or page number changes. This keeps the
    // list in sync with the backend data without the component needing custom
    // logic per resource type.
    load();
  }, [endpoint, page]);

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">DISCOVER</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {createPath && (
          <a className="button button-primary" href={createPath}>
            Create new
          </a>
        )}
      </div>

      {filters && (
        <form
          className="search-bar"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}…`}
          />
          <button className="button button-dark">Search</button>
        </form>
      )}

      <ErrorMessage>{error}</ErrorMessage>

      {loading ? (
        <Loading />
      ) : items.length ? (
        <>
          <div className="card-grid">
            {items.map((item) => (
              <ResourceCard key={item._id} item={item} type={type} />
            ))}
          </div>
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage((x) => x - 1)}>
              Previous
            </button>
            <span>Page {page}</span>
            <button
              disabled={items.length < 9}
              onClick={() => setPage((x) => x + 1)}
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <EmptyState
          title={`No ${title.toLowerCase()} found`}
          text="Try another search or check back later."
        />
      )}
    </section>
  );
}
