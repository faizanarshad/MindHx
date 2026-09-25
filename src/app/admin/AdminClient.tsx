"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminGate from "../components/AdminGate";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import {
  createResource, deleteResource, fetchAdminAnalytics, fetchAdminResources, fetchAdminUsers, updateResource,
  type AdminAnalytics, type AdminUserSummary, type ResourceInput, type ResourceRecord, type ResourceType,
} from "../lib/admin";
import { logout, type CurrentUser } from "../lib/auth";
import { resizeImageToDataUrl } from "../lib/resizeImage";

const RESOURCE_TYPES: ResourceType[] = ["meditation", "therapy", "medication", "general"];
const BAND_LABEL: Record<string, string> = { low: "Low", watch: "Watch", elevated: "Elevated", crisis: "Crisis" };

export default function AdminClient() {
  return <AdminGate>{(user) => <AdminDashboard admin={user} />}</AdminGate>;
}

function AdminDashboard({ admin }: { admin: CurrentUser }) {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [usersError, setUsersError] = useState("");
  const [resources, setResources] = useState<ResourceRecord[] | null>(null);
  const [resourcesError, setResourcesError] = useState("");
  const [editing, setEditing] = useState<ResourceRecord | null>(null);
  const [showForm, setShowForm] = useState(false);

  function loadResources() {
    fetchAdminResources()
      .then(setResources)
      .catch((err) => setResourcesError(err instanceof Error ? err.message : "Could not load resources."));
  }

  useEffect(() => {
    fetchAdminAnalytics()
      .then(setAnalytics)
      .catch((err) => setAnalyticsError(err instanceof Error ? err.message : "Could not load analytics."));
    fetchAdminUsers()
      .then(setUsers)
      .catch((err) => setUsersError(err instanceof Error ? err.message : "Could not load users."));
    loadResources();
  }, []);

  async function handleDelete(resource: ResourceRecord) {
    if (!window.confirm(`Delete "${resource.title}"? This can't be undone.`)) return;
    try {
      await deleteResource(resource.id);
      setResources((current) => current?.filter((item) => item.id !== resource.id) ?? null);
    } catch (err) {
      setResourcesError(err instanceof Error ? err.message : "Could not delete this resource.");
    }
  }

  function handleSignOut() {
    logout();
    router.push("/");
  }

  const maxBandCount = analytics ? Math.max(1, ...Object.values(analytics.band_counts)) : 1;
  const maxPageCount = analytics && analytics.top_pages.length > 0 ? Math.max(...analytics.top_pages.map((item) => item.count)) : 1;

  return (
    <>
    <main className="resource-page">
      <SiteHeader
        backLabel="New check-in"
        right={<button className="dashboard-signout" onClick={handleSignOut} type="button">Sign out</button>}
      />
      <section className="resource-hero">
        <p className="eyebrow">ADMIN</p>
        <h1>Website overview<br /><em>for {admin.email}.</em></h1>
        <p>Analytics drawn from saved accounts, check-in history, and site visits, plus the resource posts you publish here.</p>
      </section>

      <section className="admin-section">
        <h2>Analytics</h2>
        {analyticsError && <p className="assessment-error">{analyticsError}</p>}
        {!analytics && !analyticsError && <p className="dashboard-loading">Loading analytics…</p>}
        {analytics && (
          <>
            <div className="admin-stat-grid">
              <div className="admin-stat-tile"><strong>{analytics.total_pageviews}</strong><span>Total site visits</span></div>
              <div className="admin-stat-tile"><strong>{analytics.pageviews_7d}</strong><span>Visits, 7 days</span></div>
              <div className="admin-stat-tile"><strong>{analytics.pageviews_30d}</strong><span>Visits, 30 days</span></div>
              <div className="admin-stat-tile"><strong>{analytics.total_users}</strong><span>Total accounts</span></div>
              <div className="admin-stat-tile"><strong>{analytics.new_users_7d}</strong><span>New accounts, 7 days</span></div>
              <div className="admin-stat-tile"><strong>{analytics.new_users_30d}</strong><span>New accounts, 30 days</span></div>
              <div className="admin-stat-tile"><strong>{analytics.total_checkins}</strong><span>Total check-ins</span></div>
              <div className="admin-stat-tile"><strong>{analytics.checkins_7d}</strong><span>Check-ins, 7 days</span></div>
              <div className="admin-stat-tile"><strong>{analytics.checkins_30d}</strong><span>Check-ins, 30 days</span></div>
            </div>
            <div className="admin-columns">
              <div>
                <h3>Most-visited pages (30 days)</h3>
                {analytics.top_pages.length === 0 && <p className="dashboard-loading">No visits recorded yet.</p>}
                {analytics.top_pages.map((item) => (
                  <div className="admin-bar-row" key={item.path}>
                    <span>{item.path}</span>
                    <span className="admin-bar-track"><i style={{ width: `${(item.count / maxPageCount) * 100}%` }} /></span>
                    <span>{item.count}</span>
                  </div>
                ))}
              </div>
              <div>
                <h3>Check-in bands</h3>
                {Object.keys(analytics.band_counts).length === 0 && <p className="dashboard-loading">No check-ins saved yet.</p>}
                {Object.entries(analytics.band_counts).map(([band, count]) => (
                  <div className="admin-bar-row" key={band}>
                    <span>{BAND_LABEL[band] ?? band}</span>
                    <span className="admin-bar-track"><i style={{ width: `${(count / maxBandCount) * 100}%` }} /></span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="admin-top-themes">
              <h3>Top themes</h3>
              {analytics.top_themes.length === 0 && <p className="dashboard-loading">No themes recorded yet.</p>}
              <div className="theme-row">{analytics.top_themes.map((item) => <span key={item.theme}>{item.theme.replaceAll("_", " ")} ({item.count})</span>)}</div>
            </div>
          </>
        )}
      </section>

      <section className="admin-section">
        <h2>Users</h2>
        <p className="admin-section-note">Every registered account - read-only here. Never the password, transcript, or typed answers from any check-in.</p>
        {usersError && <p className="assessment-error">{usersError}</p>}
        {users === null && !usersError && <p className="dashboard-loading">Loading users…</p>}
        {users?.length === 0 && <p className="dashboard-loading">No accounts yet.</p>}
        {users && users.length > 0 && (
          <div className="admin-user-table">
            <div className="admin-user-row admin-user-head">
              <span>Email</span><span>Name</span><span>Check-ins</span><span>Role</span><span>Joined</span>
            </div>
            {users.map((user) => (
              <div className="admin-user-row" key={user.id}>
                <span>{user.email}</span>
                <span>{user.full_name || "—"}</span>
                <span>{user.checkin_count}</span>
                <span>{user.is_admin ? <b className="admin-user-badge">Admin</b> : "Member"}</span>
                <span>{new Date(user.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="admin-section">
        <div className="admin-section-heading">
          <h2>Resource posts</h2>
          <button className="check-in-button" type="button" onClick={() => { setEditing(null); setShowForm(true); }}>Add resource <span>→</span></button>
        </div>
        <p className="admin-section-note">Shown on the public /resources page - additive to the site&apos;s existing meditation/therapies content, not a replacement for it.</p>
        {resourcesError && <p className="assessment-error">{resourcesError}</p>}
        {resources === null && !resourcesError && <p className="dashboard-loading">Loading resources…</p>}
        {resources?.length === 0 && <p className="dashboard-loading">No resources yet - add the first one.</p>}
        {resources && resources.length > 0 && (
          <div className="admin-resource-list">
            {resources.map((resource) => (
              <article className="admin-resource-row" key={resource.id}>
                {resource.image_data_url && <img className="admin-resource-thumb" src={resource.image_data_url} alt="" />}
                <div>
                  <b>{resource.title}</b>
                  <span className="admin-resource-meta">{resource.resource_type} · /{resource.slug} · {resource.published ? "published" : "draft"}</span>
                  {resource.summary && <p>{resource.summary}</p>}
                </div>
                <div className="admin-resource-actions">
                  <button type="button" onClick={() => { setEditing(resource); setShowForm(true); }}>Edit</button>
                  <button type="button" onClick={() => handleDelete(resource)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
    <SiteFooter />
    {showForm && (
      <ResourceFormModal
        initial={editing}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); loadResources(); }}
      />
    )}
    </>
  );
}

function ResourceFormModal({ initial, onClose, onSaved }: { initial: ResourceRecord | null; onClose: () => void; onSaved: () => void }) {
  const [resourceType, setResourceType] = useState<ResourceType>(initial?.resource_type ?? "meditation");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(initial?.image_data_url ?? null);
  const [published, setPublished] = useState(initial?.published ?? true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadingImage(true);
    setError("");
    try {
      // Larger than an avatar (256px) since this is a post's hero image,
      // not a small circular thumbnail - still resized/compressed
      // client-side before it ever reaches the backend.
      const dataUrl = await resizeImageToDataUrl(file, 800, 0.8);
      setImageDataUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process this image.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const input: ResourceInput = { resourceType, slug: slug.trim(), title: title.trim(), summary, body, imageDataUrl, published };
    try {
      if (initial) {
        await updateResource(initial.id, input);
      } else {
        await createResource(input);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this resource.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close" type="button">×</button>
        <p className="eyebrow">ADMIN</p>
        <h2>{initial ? "Edit resource" : "Add resource"}</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Type</span>
            <select value={resourceType} onChange={(event) => setResourceType(event.target.value as ResourceType)}>
              {RESOURCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label>
            <span>Slug (lowercase, hyphens only)</span>
            <input type="text" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="box-breathing" />
          </label>
          <label>
            <span>Title</span>
            <input type="text" required value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            <span>Summary</span>
            <input type="text" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="One or two sentences" />
          </label>
          <label>
            <span>Body</span>
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} />
          </label>
          <label>
            <span>Image (optional)</span>
            {imageDataUrl && <img className="admin-image-preview" src={imageDataUrl} alt="" />}
            <input type="file" accept="image/*" onChange={handleImageChange} disabled={uploadingImage} />
            {imageDataUrl && <button type="button" className="admin-image-remove" onClick={() => setImageDataUrl(null)}>Remove image</button>}
          </label>
          <label className="admin-published-toggle">
            <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
            <span>Published (visible on the public site)</span>
          </label>
          {error && <p className="assessment-error auth-error">{error}</p>}
          <button className="check-in-button" type="submit" disabled={loading || uploadingImage}>{loading ? "Saving…" : initial ? "Save changes" : "Add resource"} <span>→</span></button>
        </form>
      </div>
    </div>
  );
}
