
import { useEffect, useRef, useState } from "react";
import api from "../../services/api";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const CROP_STAGE_SIZE = 220;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function ProfilePage() {
  const [form, setForm] = useState({
    name: "",
    bio: "",
    location: "",
    avatar: "",
  });

  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [previewSize, setPreviewSize] = useState({ width: 1, height: 1 });
  const [crop, setCrop] = useState({ x: 0, y: 0, zoom: 1 });
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const dragStartRef = useRef({ x: 0, y: 0, originX: 0, originY: 0 });
  const cropStageRef = useRef(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await api.get("/users/me");
        const user = response.data.data.user;

        setForm({
          name: user.name || "",
          bio: user.bio || "",
          location: user.location || "",
          avatar: user.avatar || "",
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  useEffect(() => {
    if (!dragging) return;

    function handlePointerMove(event) {
      const dx = event.clientX - dragStartRef.current.x;
      const dy = event.clientY - dragStartRef.current.y;

      const coverScale =
        Math.max(CROP_STAGE_SIZE / previewSize.width, CROP_STAGE_SIZE / previewSize.height) * crop.zoom;
      const renderWidth = previewSize.width * coverScale;
      const renderHeight = previewSize.height * coverScale;
      const maxX = Math.max(0, (renderWidth - CROP_STAGE_SIZE) / 2);
      const maxY = Math.max(0, (renderHeight - CROP_STAGE_SIZE) / 2);

      setCrop((current) => ({
        ...current,
        x: clamp(dragStartRef.current.originX + dx, -maxX, maxX),
        y: clamp(dragStartRef.current.originY + dy, -maxY, maxY),
      }));
    }

    function stopDragging() {
      setDragging(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
    };
  }, [dragging, crop.zoom, previewSize]);

  function resetCrop() {
    setCrop({ x: 0, y: 0, zoom: 1 });
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];

    setMessage("");
    setError("");

    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setError("Please select a JPEG, PNG, or WebP image.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("The profile image must not exceed 5 MB.");
      e.target.value = "";
      return;
    }

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    const url = URL.createObjectURL(file);
    setSelectedImage(file);
    setPreview(url);
    setPreviewSize({ width: 1, height: 1 });
    resetCrop();
    e.target.value = "";
  }

  function startDrag(event) {
    if (!preview) return;

    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      originX: crop.x,
      originY: crop.y,
    };

    setDragging(true);
  }

  async function cropAndUpload() {
    if (!selectedImage || !preview) {
      setError("Please choose a profile image to crop.");
      return;
    }

    setUploading(true);
    setMessage("");
    setError("");

    try {
      const image = new Image();
      image.src = preview;

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("The image could not be processed."));
      });

      const stageSize = CROP_STAGE_SIZE;
      const coverScale =
        Math.max(stageSize / image.naturalWidth, stageSize / image.naturalHeight) * crop.zoom;
      const renderWidth = image.naturalWidth * coverScale;
      const renderHeight = image.naturalHeight * coverScale;
      const left = (stageSize - renderWidth) / 2 + crop.x;
      const top = (stageSize - renderHeight) / 2 + crop.y;
      const sourceWidth = stageSize / coverScale;
      const sourceHeight = stageSize / coverScale;
      const sourceX = clamp((0 - left) / coverScale, 0, Math.max(0, image.naturalWidth - sourceWidth));
      const sourceY = clamp((0 - top) / coverScale, 0, Math.max(0, image.naturalHeight - sourceHeight));

      const canvas = document.createElement("canvas");
      const outputSize = 512;
      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext("2d");

      context.fillStyle = "#fff";
      context.fillRect(0, 0, outputSize, outputSize);
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        outputSize,
        outputSize
      );

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));

      if (!blob) {
        throw new Error("The cropped image could not be prepared.");
      }

      const formData = new FormData();
      formData.append("avatar", blob, selectedImage.name || "profile.jpg");

      const response = await api.post("/users/me/avatar", formData);
      const user = response.data.data.user;

      setForm((current) => ({
        ...current,
        avatar: user.avatar || "",
      }));

      setSelectedImage(null);
      setPreview("");
      setPreviewSize({ width: 1, height: 1 });
      resetCrop();
      setMessage("Profile photo uploaded successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await api.patch("/users/me", {
        name: form.name,
        bio: form.bio,
        location: form.location,
      });

      const user = response.data.data.user;

      setForm((current) => ({
        ...current,
        name: user.name || "",
        bio: user.bio || "",
        location: user.location || "",
        avatar: user.avatar || current.avatar,
      }));

      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="profile-shell profile-shell-loading">
        <div className="profile-card profile-card-loading">
          <p>Loading your profile...</p>
        </div>
      </section>
    );
  }

  const initials = form.name
    ? form.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  const coverScale =
    Math.max(CROP_STAGE_SIZE / previewSize.width, CROP_STAGE_SIZE / previewSize.height) * crop.zoom;
  const renderWidth = previewSize.width * coverScale;
  const renderHeight = previewSize.height * coverScale;

  return (
    <section className="profile-shell">
      <aside className="profile-summary">
        <div className="profile-summary-badge">Your account</div>
        <div className="profile-summary-avatar">
          {preview || form.avatar ? (
            <img src={preview || form.avatar} alt="Profile preview" />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className="profile-summary-body">
          <h2>{form.name || "New member"}</h2>
          <p>
            {form.bio?.trim() || "Add a short bio so your communities get to know you."}
          </p>
        </div>

        <div className="profile-summary-meta">
          <span>{form.location || "Location not set"}</span>
          <span>Community member</span>
        </div>
      </aside>

      <div className="profile-card">
        <div className="profile-header">
          <div>
            <p className="eyebrow">YOUR ACCOUNT</p>
            <h1>Edit profile</h1>
          </div>
          <button type="submit" form="profile-form" className="button button-primary">
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>

        {message && (
          <p className="alert alert-success" role="status">
            {message}
          </p>
        )}

        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}

        <div className="profile-layout">
          <div className="profile-photo-section">
            <h2>Profile photo</h2>

            {selectedImage ? (
              <>
                <p className="crop-instructions">Drag to reposition and zoom to fit your profile photo.</p>

                <div
                  ref={cropStageRef}
                  className="crop-stage"
                  onPointerDown={startDrag}
                  aria-label="Profile photo crop area"
                  role="img"
                >
                  <img
                    src={preview}
                    alt="Crop preview"
                    onLoad={(event) => {
                      setPreviewSize({
                        width: event.target.naturalWidth,
                        height: event.target.naturalHeight,
                      });
                    }}
                    style={{
                      width: renderWidth,
                      height: renderHeight,
                      transform: `translate(${crop.x}px, ${crop.y}px)`,
                    }}
                  />
                </div>

                <label className="crop-control">
                  Zoom
                  <input
                    type="range"
                    min="1"
                    max="2.4"
                    step="0.01"
                    value={crop.zoom}
                    aria-label="Zoom profile photo"
                    onChange={(event) =>
                      setCrop((current) => ({
                        ...current,
                        zoom: Number(event.target.value),
                      }))
                    }
                  />
                </label>

                <div className="crop-actions">
                  <button
                    type="button"
                    className="button button-dark"
                    onClick={cropAndUpload}
                    disabled={uploading}
                  >
                    {uploading ? "Uploading..." : "Apply crop"}
                  </button>
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={() => {
                      setSelectedImage(null);
                      if (preview) {
                        URL.revokeObjectURL(preview);
                      }
                      setPreview("");
                      resetCrop();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="profile-photo-preview">
                  {preview || form.avatar ? (
                    <img src={preview || form.avatar} alt="Profile preview" />
                  ) : (
                    <div className="profile-photo-placeholder">{initials}</div>
                  )}
                </div>

                <input
                  id="profile-avatar-upload"
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  disabled={uploading}
                />

                <label htmlFor="profile-avatar-upload" className="button button-primary button-wide upload-trigger">
                  Choose a profile photo
                </label>

                <p className="helper-text" style={{ marginTop: "12px" }}>
                  JPEG, PNG or WebP. Maximum file size: 5 MB.
                </p>
              </>
            )}
          </div>

          <form id="profile-form" onSubmit={submit} className="profile-form">
            <label className="field">
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>

            <label className="field">
              Bio
              <textarea
                rows="5"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Tell your communities a little about yourself..."
              />
            </label>

            <label className="field">
              Location
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="City, region or country"
              />
            </label>
          </form>
        </div>
      </div>
    </section>
  );
}
