import { api } from "@/lib/server/http";
import { getWorkspace } from "@/lib/server/actions";
export const GET = (request: Request) => api(request, user => getWorkspace(user));
