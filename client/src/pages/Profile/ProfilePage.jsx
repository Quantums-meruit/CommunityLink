
import { useEffect, useRef, useState } from "react";
import api from "../../services/api";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MIN_CROP_ZOOM = 1;
const MAX_CROP_ZOOM = 3;
const INITIAL_CROP_SIZE = 0.75;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getImageLayout(naturalSize, stageSize) {
  const scale = Math.min(
    stageSize.width / naturalSize.width,
    stageSize.height / naturalSize.height,
  );
  const width = naturalSize.width * scale;
  const height = naturalSize.height * scale;

  return {
    left: (stageSize.width - width) / 2,
    top: (stageSize.height - height) / 2,
    width,
    height,
  };
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
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [imageLayout, setImageLayout] = useState(null);
  const [crop, setCrop] = useState({ centerX: 0.5, centerY: 0.5, zoom: 1 });
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const dragStartRef = useRef({
    pointerX: 0,
    pointerY: 0,
    centerX: 0.5,
    centerY: 0.5,
  });
  const activePointerRef = useRef(null);
  const cropStageRef = useRef(null);
  const cropDialogRef = useRef(null);
  const cropCloseButtonRef = useRef(null);

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
    if (!selectedImage || !cropStageRef.current || !previewSize.width) return;

    const stage = cropStageRef.current;
    const updateLayout = () => {
      const bounds = stage.getBoundingClientRect();
      setImageLayout(
        getImageLayout(previewSize, {
          width: bounds.width,
          height: bounds.height,
        }),
      );
    };

    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [selectedImage, previewSize]);

  useEffect(() => {
    if (!selectedImage) return;

    const previousFocus = document.activeElement;
    cropCloseButtonRef.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [selectedImage]);

  useEffect(() => {
    if (!selectedImage) return;

    function handleDialogKeys(event) {
      if (event.key === "Escape" && !uploading) {
        event.preventDefault();
        cancelCrop();
        return;
      }

      if (event.key === "Tab") {
        const focusableElements = cropDialogRef.current?.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), [tabindex="0"]',
        );
        if (!focusableElements?.length) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        const focusIsInside = cropDialogRef.current?.contains(
          document.activeElement,
        );

        if (
          (event.shiftKey && document.activeElement === firstElement) ||
          (event.shiftKey && !focusIsInside)
        ) {
          event.preventDefault();
          lastElement.focus();
        } else if (
          (!event.shiftKey && document.activeElement === lastElement) ||
          (!event.shiftKey && !focusIsInside)
        ) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }

    window.addEventListener("keydown", handleDialogKeys);
    return () => window.removeEventListener("keydown", handleDialogKeys);
  }, [selectedImage, uploading]);

  function getCropFrameSize(zoom = crop.zoom, layout = imageLayout) {
    if (!layout) return 0;
    return (Math.min(layout.width, layout.height) * INITIAL_CROP_SIZE) / zoom;
  }

  function constrainCrop(centerX, centerY, zoom = crop.zoom, layout = imageLayout) {
    if (!layout) return { centerX: 0.5, centerY: 0.5 };

    const halfWidth = getCropFrameSize(zoom, layout) / (2 * layout.width);
    const halfHeight = getCropFrameSize(zoom, layout) / (2 * layout.height);

    return {
      centerX: clamp(centerX, halfWidth, 1 - halfWidth),
      centerY: clamp(centerY, halfHeight, 1 - halfHeight),
    };
  }

  function resetCrop() {
    setCrop({ centerX: 0.5, centerY: 0.5, zoom: MIN_CROP_ZOOM });
  }

  function updateZoom(nextZoom) {
    const zoom = clamp(nextZoom, MIN_CROP_ZOOM, MAX_CROP_ZOOM);
    setCrop((current) => ({
      ...constrainCrop(current.centerX, current.centerY, zoom),
      zoom,
    }));
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
    setPreviewSize({ width: 0, height: 0 });
    setImageLayout(null);
    resetCrop();
    e.target.value = "";
  }

  function startCropDrag(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerRef.current = event.pointerId;
    dragStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      centerX: crop.centerX,
      centerY: crop.centerY,
    };
    setDragging(true);
  }

  function moveCropFrame(event) {
    if (activePointerRef.current !== event.pointerId || !imageLayout) return;
    event.preventDefault();

    const stage = cropStageRef.current?.getBoundingClientRect();
    if (!stage) return;

    const nextCenterX =
      dragStartRef.current.centerX +
      (event.clientX - dragStartRef.current.pointerX) / imageLayout.width;
    const nextCenterY =
      dragStartRef.current.centerY +
      (event.clientY - dragStartRef.current.pointerY) / imageLayout.height;

    setCrop((current) => ({
      ...constrainCrop(nextCenterX, nextCenterY),
      zoom: current.zoom,
    }));
  }

  function stopCropDrag(event) {
    if (activePointerRef.current !== event.pointerId) return;
    activePointerRef.current = null;
    setDragging(false);
  }

  function nudgeCrop(event) {
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];

    if (!direction) return;
    event.preventDefault();

    const distance = event.shiftKey ? 0.03 : 0.005;
    setCrop((current) => ({
      ...constrainCrop(
        current.centerX + direction[0] * distance,
        current.centerY + direction[1] * distance,
      ),
      zoom: current.zoom,
    }));
  }

  function cancelCrop() {
    activePointerRef.current = null;
    setDragging(false);
    setSelectedImage(null);
    setPreview("");
    setPreviewSize({ width: 0, height: 0 });
    setImageLayout(null);
    resetCrop();
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

      const sourceSize =
        (Math.min(image.naturalWidth, image.naturalHeight) *
          INITIAL_CROP_SIZE) /
        crop.zoom;
      const sourceX = clamp(
        crop.centerX * image.naturalWidth - sourceSize / 2,
        0,
        image.naturalWidth - sourceSize,
      );
      const sourceY = clamp(
        crop.centerY * image.naturalHeight - sourceSize / 2,
        0,
        image.naturalHeight - sourceSize,
      );

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
        sourceSize,
        sourceSize,
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
      setPreviewSize({ width: 0, height: 0 });
      setImageLayout(null);
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

  const cropFrameSize = getCropFrameSize();
  const cropFrameStyle = imageLayout
    ? {
        left:
          imageLayout.left +
          crop.centerX * imageLayout.width -
          cropFrameSize / 2,
        top:
          imageLayout.top +
          crop.centerY * imageLayout.height -
          cropFrameSize / 2,
        width: cropFrameSize,
        height: cropFrameSize,
      }
    : undefined;

  return (
    <section className="profile-shell">
      <header className="profile-page-intro">
        <div>
          <p className="eyebrow">MEMBER PROFILE</p>
          <h1>Your profile</h1>
          <p>Make it easier for your community to know you and start a conversation.</p>
        </div>
        <span className="profile-intro-status">
          <span aria-hidden="true" />
          Your account
        </span>
      </header>

      <aside className="profile-summary">
        <div className="profile-summary-badge">PROFILE PREVIEW</div>
        <div className="profile-summary-avatar">
          {form.avatar ? (
            <img src={form.avatar} alt="" />
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
            <p className="eyebrow">PERSONAL DETAILS</p>
            <h2>Make it yours</h2>
            <p className="profile-header-description">
              Keep your details current so members can recognize and connect with you.
            </p>
          </div>
          <button type="submit" form="profile-form" className="button button-primary">
            {saving ? "Saving..." : "Save changes"}
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
            <p className="profile-photo-description">
              Choose a clear photo that feels like you.
            </p>
            <div className="profile-photo-preview profile-photo-picker">
              {form.avatar ? (
                <img src={form.avatar} alt="Current profile photo" />
              ) : (
                <div className="profile-photo-placeholder">{initials}</div>
              )}
              <input
                id="profile-avatar-upload"
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                disabled={uploading}
              />
              <label
                htmlFor="profile-avatar-upload"
                className="profile-photo-add"
                aria-label="Choose a profile photo"
                title="Choose a profile photo"
              >
                +
              </label>
            </div>
            <p className="helper-text">
              Add or change your photo. JPEG, PNG or WebP, up to 5 MB.
            </p>
          </div>

          <form id="profile-form" onSubmit={submit} className="profile-form">
            <div className="field">
              <label htmlFor="profile-name">Name</label>
              <input
                id="profile-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoComplete="name"
                aria-describedby="profile-name-hint"
              />
              <span className="profile-field-hint" id="profile-name-hint">
                Use the name you want community members to recognize.
              </span>
            </div>

            <div className="field">
              <label htmlFor="profile-bio">Bio</label>
              <textarea
                id="profile-bio"
                rows="5"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Tell your communities a little about yourself..."
                aria-describedby="profile-bio-hint"
              />
              <span className="profile-field-hint" id="profile-bio-hint">
                A sentence or two is a great place to start.
              </span>
            </div>

            <div className="field">
              <label htmlFor="profile-location">Location</label>
              <input
                id="profile-location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="City, region or country"
                autoComplete="address-level2"
                aria-describedby="profile-location-hint"
              />
              <span className="profile-field-hint" id="profile-location-hint">
                Add a general area to help people nearby find you.
              </span>
            </div>
          </form>
        </div>
      </div>

      {selectedImage && (
        <div
          className="crop-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !uploading) {
              cancelCrop();
            }
          }}
        >
          <section
            ref={cropDialogRef}
            className="crop-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="crop-modal-title"
          >
            <div className="crop-modal-header">
              <div>
                <p className="eyebrow">Profile photo</p>
                <h2 id="crop-modal-title">Choose your photo crop</h2>
                <p>Move the circle to choose what people will see.</p>
              </div>
              <button
                ref={cropCloseButtonRef}
                type="button"
                className="crop-modal-close"
                onClick={cancelCrop}
                disabled={uploading}
                aria-label="Close photo editor"
              >
                ×
              </button>
            </div>

            <div className="crop-editor-layout">
              <div
                ref={cropStageRef}
                className="crop-editor-stage"
                aria-label="Photo crop editor"
              >
                <img
                  className="crop-editor-image"
                  src={preview}
                  alt="Selected photo"
                  style={
                    imageLayout
                      ? {
                          left: imageLayout.left,
                          top: imageLayout.top,
                          width: imageLayout.width,
                          height: imageLayout.height,
                        }
                      : { visibility: "hidden" }
                  }
                  onLoad={(event) =>
                    setPreviewSize({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    })
                  }
                />
                {imageLayout && (
                  <div
                    className={`crop-selection${dragging ? " is-dragging" : ""}`}
                    style={cropFrameStyle}
                    onPointerDown={startCropDrag}
                    onPointerMove={moveCropFrame}
                    onPointerUp={stopCropDrag}
                    onPointerCancel={stopCropDrag}
                    onKeyDown={nudgeCrop}
                    role="group"
                    aria-label="Circular crop selection. Use arrow keys to adjust its position."
                    tabIndex={0}
                  >
                    <span aria-hidden="true">Move</span>
                  </div>
                )}
              </div>

              <div className="crop-editor-controls">
                <p className="crop-editor-hint">
                  The dimmed area will be cropped out. Drag the circular frame
                  to select your profile picture.
                </p>
                <div className="crop-control">
                  <div className="crop-control-heading">
                    <label htmlFor="profile-photo-zoom">Crop size</label>
                    <output htmlFor="profile-photo-zoom">
                      {Math.round((INITIAL_CROP_SIZE / crop.zoom) * 100)}%
                    </output>
                  </div>
                  <div className="crop-zoom-controls">
                    <button
                      type="button"
                      className="crop-zoom-button"
                      onClick={() => updateZoom(crop.zoom - 0.1)}
                      disabled={crop.zoom <= MIN_CROP_ZOOM}
                      aria-label="Show a larger crop area"
                    >
                      −
                    </button>
                    <input
                      id="profile-photo-zoom"
                      type="range"
                      min={MIN_CROP_ZOOM}
                      max={MAX_CROP_ZOOM}
                      step="0.05"
                      value={crop.zoom}
                      aria-label="Adjust crop size"
                      onChange={(event) =>
                        updateZoom(Number(event.target.value))
                      }
                    />
                    <button
                      type="button"
                      className="crop-zoom-button"
                      onClick={() => updateZoom(crop.zoom + 0.1)}
                      disabled={crop.zoom >= MAX_CROP_ZOOM}
                      aria-label="Show a smaller crop area"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="crop-actions">
                  <button
                    type="button"
                    className="button button-quiet crop-reset-button"
                    onClick={resetCrop}
                    disabled={
                      uploading ||
                      (crop.centerX === 0.5 &&
                        crop.centerY === 0.5 &&
                        crop.zoom === MIN_CROP_ZOOM)
                    }
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={cancelCrop}
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={cropAndUpload}
                    disabled={uploading || !imageLayout}
                  >
                    {uploading ? "Uploading..." : "Use photo"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
