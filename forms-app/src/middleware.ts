import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
    const path = req.nextUrl.pathname;
    const isAuthenticated = !!req.auth;

    console.log("[MIDDLEWARE] Path:", path);
    console.log("[MIDDLEWARE] Authenticated:", isAuthenticated);
    console.log("[MIDDLEWARE] Session:", req.auth ? JSON.stringify(req.auth.user?.email) : "null");

    // Rotas públicas que não precisam de autenticação
    const publicRoutes = ["/login", "/api/auth", "/f/", "/vendor", "/api/vendor"];
    const isPublicRoute = publicRoutes.some((route) => path.startsWith(route));

    if (isPublicRoute) {
        // Se estiver autenticado e tentar acessar /login, redireciona para dashboard
        if (path === "/login" && isAuthenticated) {
            console.log("[MIDDLEWARE] Already authenticated, redirecting to dashboard");
            return NextResponse.redirect(new URL("/dashboard", req.url));
        }
        console.log("[MIDDLEWARE] Public route, allowing");
        return NextResponse.next();
    }

    // Se não estiver autenticado, redireciona para login
    if (!isAuthenticated) {
        console.log("[MIDDLEWARE] Not authenticated, redirecting to login");
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("callbackUrl", path);
        return NextResponse.redirect(loginUrl);
    }

    console.log("[MIDDLEWARE] Authenticated, allowing access");
    return NextResponse.next();
});

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|logo.png|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
