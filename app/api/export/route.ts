import { api } from "@/lib/server/http";
import { exportWorkspace } from "@/lib/server/actions";
export const GET = (request: Request) => api(request, user => exportWorkspace(user));
