import { api } from "@/lib/server/http";
import { saveProfile } from "@/lib/server/actions";
export const PUT = (request: Request) => api(request, user => saveProfile(request, user));
