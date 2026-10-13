import { api } from "@/lib/server/http";
import { patchJob } from "@/lib/server/actions";
export const PATCH = (request: Request, context: { params: Promise<{ id: string }> }) => api(request, async user => patchJob(request, user, (await context.params).id));
