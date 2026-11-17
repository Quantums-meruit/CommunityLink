import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { ErrorMessage } from "../common/Feedback";

// ResourceForm is the generic create form used by communities, events,
// businesses, and opportunities. By passing a field schema, the same UI can
// support different backend endpoints without duplicating form logic.
export default function ResourceForm({
  title,
  endpoint,
  fields,
  submitLabel = "Publish",
}) {
  const [values, setValues] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      // Some create routes need a communityId to be inserted into the URL, e.g.
      // /communities/:communityId/events. The generic form handles that mapping
      // before sending the payload to the API.
      const target = endpoint.includes(":communityId")
        ? endpoint.replace(":communityId", values.communityId)
        : endpoint;

      const payload = { ...values };
      delete payload.communityId;

      await api.post(target, payload);
      navigate(-1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="form-panel">
      <p className="eyebrow">COMMUNITYLINK</p>
      <h1>{title}</h1>
      <form onSubmit={submit}>
        <ErrorMessage>{error}</ErrorMessage>
        {fields.map((f) => (
          <label className="field" key={f.name}>
            {f.label}
            {f.type === "textarea" ? (
              <textarea
                required={f.required !== false}
                rows="5"
                value={values[f.name] || ""}
                onChange={(e) =>
                  setValues({ ...values, [f.name]: e.target.value })
                }
              />
            ) : (
              <input
                required={f.required !== false}
                type={f.type || "text"}
                min={f.type === "number" ? 1 : undefined}
                value={values[f.name] || ""}
                onChange={(e) =>
                  setValues({ ...values, [f.name]: e.target.value })
                }
              />
            )}
          </label>
        ))}

        <button className="button button-primary" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </button>
      </form>
    </section>
  );
}
