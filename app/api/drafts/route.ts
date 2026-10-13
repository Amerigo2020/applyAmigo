import { api } from "@/lib/server/http";
import { addDraft } from "@/lib/server/actions";
export const POST = (request: Request) => api(request, user => addDraft(request, user));
