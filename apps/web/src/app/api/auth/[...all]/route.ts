import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/serveur/auth";

export const { GET, POST } = toNextJsHandler(auth);
