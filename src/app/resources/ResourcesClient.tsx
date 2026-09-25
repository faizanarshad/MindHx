"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import { DoodleLeaf, DoodleSun, DoodleWave } from "../components/Doodles";
import NatureBanner from "../components/NatureBanner";
import { naturePhotos } from "../components/naturePhotos";
import SiteFooter from "../components/SiteFooter";
import { fetchPublishedResources, type ResourceRecord } from "../lib/admin";

const TYPE_LABEL: Record<string, string> = { meditation: "Meditation", therapy: "Therapy", medication: "Medication", general: "General" };

export default function ResourcesClient() {
  const [resources, setResources] = useState<ResourceRecord[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPublishedResources()
      .then(setResources)
      .catch(() => setError("Could not load resources right now."));
  }, []);

  return (
    <>
    <main className="resource-page">
      <DoodleSun className="doodle doodle-orange doodle-float-slow" style={{ top: "95px", right: "5%" }} />
      <DoodleLeaf className="doodle doodle-teal doodle-sway" style={{ top: "55%", left: "2%", width: "26px", height: "auto" }} />
      <DoodleWave className="doodle doodle-blue doodle-float" style={{ bottom: "6%", right: "8%" }} />
      <SiteHeader backLabel="Back to check-in" />
      <section className="resource-hero">
        <p className="eyebrow">RESOURCES</p>
        <h1>Additional guidance<br /><em>from the MindHx team.</em></h1>
        <p>Alongside our meditation techniques and therapy approaches - general information, not individualized treatment.</p>
      </section>
      <NatureBanner {...naturePhotos.meadow} priority />
      {error && <p className="assessment-error dashboard-error">{error}</p>}
      {resources === null && !error && <p className="dashboard-loading">Loading…</p>}
      {resources?.length === 0 && <p className="dashboard-loading">No resources published yet - check back soon.</p>}
      {resources && resources.length > 0 && (
        <section className="reference-grid">
          {resources.map((resource) => (
            <Link key={resource.id} href={`/resources/${resource.slug}`} className="reference-card-link">
              <article>
                {resource.image_data_url && <img className="reference-card-image" src={resource.image_data_url} alt="" />}
                <p className="card-kicker">{TYPE_LABEL[resource.resource_type] ?? resource.resource_type}</p>
                <h2>{resource.title}</h2>
                <p className="reference-card-summary">{resource.summary}</p>
                <footer>Read more →</footer>
              </article>
            </Link>
          ))}
        </section>
      )}
    </main>
    <SiteFooter />
    </>
  );
}
