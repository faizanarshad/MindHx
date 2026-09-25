"use client";

import { useEffect, useState } from "react";
import SiteHeader from "../../components/SiteHeader";
import NatureBanner from "../../components/NatureBanner";
import { naturePhotos } from "../../components/naturePhotos";
import SiteFooter from "../../components/SiteFooter";
import { fetchResourceBySlug, type ResourceRecord } from "../../lib/admin";

const TYPE_LABEL: Record<string, string> = { meditation: "Meditation", therapy: "Therapy", medication: "Medication", general: "General" };

export default function ResourceDetailClient({ slug }: { slug: string }) {
  const [resource, setResource] = useState<ResourceRecord | null | undefined>(undefined);

  useEffect(() => {
    fetchResourceBySlug(slug)
      .then((result) => {
        setResource(result);
        if (result) document.title = `${result.title} | MindHx`;
      })
      .catch(() => setResource(null));
  }, [slug]);

  if (resource === undefined) {
    return <><main className="resource-page"><p className="dashboard-loading">Loading…</p></main><SiteFooter /></>;
  }

  if (!resource) {
    return (
      <>
      <main className="resource-page">
        <SiteHeader backLabel="Back to check-in" />
        <section className="resource-hero">
          <p className="eyebrow">RESOURCES</p>
          <h1>Not found</h1>
          <p>This resource doesn&apos;t exist or isn&apos;t published.</p>
        </section>
      </main>
      <SiteFooter />
      </>
    );
  }

  return (
    <>
    <main className="resource-page">
      <SiteHeader backLabel="Back to check-in" />
      <section className="resource-hero">
        <p className="eyebrow">{TYPE_LABEL[resource.resource_type] ?? resource.resource_type}</p>
        <h1>{resource.title}</h1>
        {resource.summary && <p>{resource.summary}</p>}
      </section>
      <NatureBanner {...naturePhotos.meadow} priority />
      <section className="admin-section">
        <div className="resource-body">{resource.body.split("\n").map((paragraph, index) => paragraph.trim() && <p key={index}>{paragraph}</p>)}</div>
      </section>
    </main>
    <SiteFooter />
    </>
  );
}
