// Admin-only API calls (/admin/*) - analytics and the resource CMS. Every
// call here requires a signed-in account with is_admin set (see
// backend/auth.py's get_current_admin); the backend enforces this
// independently (403 for a signed-in non-admin, 401 for signed-out), this
// layer doesn't gate anything on its own.
import { API_BASE } from "./api";
import { authFetch, parseErrorDetail } from "./auth";

export type AdminAnalytics = {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  total_checkins: number;
  checkins_7d: number;
  checkins_30d: number;
  band_counts: Record<string, number>;
  top_themes: { theme: string; count: number }[];
};

export async function fetchAdminAnalytics(): Promise<AdminAnalytics> {
  const response = await authFetch("/admin/analytics");
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  return await response.json() as AdminAnalytics;
}

export type ResourceType = "meditation" | "therapy" | "medication" | "general";

export type ResourceRecord = {
  id: string;
  resource_type: ResourceType;
  slug: string;
  title: string;
  summary: string;
  body: string;
  published: boolean;
  created_at: string;
  updated_at: string;
};

export type ResourceInput = {
  resourceType: ResourceType;
  slug: string;
  title: string;
  summary?: string;
  body?: string;
  published?: boolean;
};

export async function fetchPublishedResources(resourceType?: ResourceType): Promise<ResourceRecord[]> {
  const query = resourceType ? `?resource_type=${encodeURIComponent(resourceType)}` : "";
  const response = await fetch(`${API_BASE}/resources${query}`);
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  return await response.json() as ResourceRecord[];
}

export async function fetchResourceBySlug(slug: string): Promise<ResourceRecord | null> {
  const response = await fetch(`${API_BASE}/resources/${encodeURIComponent(slug)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  return await response.json() as ResourceRecord;
}

export async function fetchAdminResources(): Promise<ResourceRecord[]> {
  const response = await authFetch("/admin/resources");
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  return await response.json() as ResourceRecord[];
}

export async function createResource(input: ResourceInput): Promise<ResourceRecord> {
  const response = await authFetch("/admin/resources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resource_type: input.resourceType,
      slug: input.slug,
      title: input.title,
      summary: input.summary ?? "",
      body: input.body ?? "",
      published: input.published ?? true,
    }),
  });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  return await response.json() as ResourceRecord;
}

export async function updateResource(id: string, update: Partial<ResourceInput>): Promise<ResourceRecord> {
  const body: Record<string, unknown> = {};
  if (update.resourceType !== undefined) body.resource_type = update.resourceType;
  if (update.slug !== undefined) body.slug = update.slug;
  if (update.title !== undefined) body.title = update.title;
  if (update.summary !== undefined) body.summary = update.summary;
  if (update.body !== undefined) body.body = update.body;
  if (update.published !== undefined) body.published = update.published;

  const response = await authFetch(`/admin/resources/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
  return await response.json() as ResourceRecord;
}

export async function deleteResource(id: string): Promise<void> {
  const response = await authFetch(`/admin/resources/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseErrorDetail(response));
}
