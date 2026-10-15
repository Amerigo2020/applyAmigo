import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplicationWorkspace } from "@/components/workspace/application-workspace";
import { workspaceView } from "@/lib/navigation";
export const metadata: Metadata = { title: "Workspace | applyAmigo", robots: { index: false, follow: false } };
export default async function Dashboard({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section = [] } = await params;
  if (!workspaceView(`/dashboard${section.length ? `/${section.join("/")}` : ""}`)) notFound();
  return <ApplicationWorkspace />;
}
