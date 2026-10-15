export const workspaceRoutes = {
  overview: "/dashboard",
  discover: "/dashboard/stellen",
  applications: "/dashboard/bewerbungen",
  documents: "/dashboard/unterlagen",
  sprint: "/dashboard/zeitplan",
  settings: "/dashboard/einstellungen",
} as const;
export type WorkspaceView = keyof typeof workspaceRoutes;
export function workspaceView(pathname: string): WorkspaceView | undefined {
  const normalized = pathname.replace(/\/+$/, "");
  return (Object.keys(workspaceRoutes) as WorkspaceView[]).find(view => workspaceRoutes[view] === normalized);
}
