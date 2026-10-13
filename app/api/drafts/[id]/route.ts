import { api } from "@/lib/server/http";
import { patchDraft } from "@/lib/server/actions";
export const PATCH = (request: Request, context: { params: Promise<{ id: string }> }) => api(request, async user => patchDraft(request, user, (await context.params).id));
