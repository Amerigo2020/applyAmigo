import { api } from "@/lib/server/http";
import { demo } from "@/lib/server/actions";
export const POST = (request: Request) => api(request, user => demo(user));
