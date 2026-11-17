import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../../services/api";

const unwrapData = (response) => response?.data?.data ?? response?.data ?? {};

export default function PostDetailsPage() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/posts/${id}`)
      .then((response) => {
        const payload = unwrapData(response);
        setPost(payload.post || null);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return <p className="alert alert-error">{error}</p>;
  }

  return post ? (
    <article className="detail-panel">
      <h1>Community post</h1>
      <p>{post.content}</p>
    </article>
  ) : (
    <p className="page-state">Loading post…</p>
  );
}
