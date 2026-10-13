import { api } from "@/lib/server/http";
import { getSources, saveSources } from "@/lib/server/actions";
export const GET = (request: Request) => api(request, user => getSources(user));
export const POST = (request: Request) => api(request, user => saveSources(request, user));
