import { api } from "@/lib/server/http";
import { addJob } from "@/lib/server/actions";
export const POST = (request: Request) => api(request, user => addJob(request, user));
