import { api } from "@/lib/server/http";
import { scan } from "@/lib/server/actions";
export const POST = (request: Request) => api(request, user => scan(user));
