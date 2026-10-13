import { api } from "@/lib/server/http";
import { saveBlocks } from "@/lib/server/actions";
export const PUT = (request: Request) => api(request, user => saveBlocks(request, user));
