import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Redirection rapide vers la connexion quand aucun cookie de session n'est présent.
 * Ce n'est pas une vérification de sécurité : la session est vérifiée côté serveur par
 * `exigerUtilisateur()` dans chaque page, action et route qui touche aux données.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const url = new URL("/connexion", request.url);
  const suite = request.nextUrl.pathname + request.nextUrl.search;
  if (suite !== "/") url.searchParams.set("suite", suite);
  return NextResponse.redirect(url);
}

export const config = {
  // Tout sauf la connexion, l'activation par lien, l'API (protégée elle-même), les fichiers de Next.js et les fichiers publics.
  matcher: ["/((?!connexion|activer|api|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)"],
};
