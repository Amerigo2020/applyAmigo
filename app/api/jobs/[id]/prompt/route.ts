import { api } from "@/lib/server/http";
import { exportPrompt } from "@/lib/server/actions";
export const GET = (request: Request, context: { params: Promise<{ id: string }> }) => api(request, async user => exportPrompt(request, user, (await context.params).id));
