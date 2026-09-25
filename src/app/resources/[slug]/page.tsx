import type { Metadata } from "next";
import { pageMetadata } from "../../lib/seo";
import ResourceDetailClient from "./ResourceDetailClient";

export async function generateMetadata({ params }: PageProps<"/resources/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return pageMetadata({
    title: "Resource",
    description: "Additional guidance from the MindHx team.",
    path: `/resources/${slug}`,
  });
}

export default async function Page({ params }: PageProps<"/resources/[slug]">) {
  const { slug } = await params;
  return <ResourceDetailClient slug={slug} />;
}
