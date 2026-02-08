import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export default async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname;
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const secureCookie = forwardedProto === "https" || process.env.NODE_ENV === "production";
    const token = await getToken({
        req,
        secret: process.env.AUTH_SECRET,
        secureCookie,
    });

    // Rotas públicas que não precisam de autenticação
    const publicRoutes = ["/login", "/api/auth", "/f/", "/vendor", "/api/vendor"];
    const isPublicRoute = publicRoutes.some((route) => path.startsWith(route));

    if (isPublicRoute) {
        // Se já estiver logado e tentar acessar /login, redireciona para dashboard
        if (path === "/login" && token) {
            return NextResponse.redirect(new URL("/dashboard", req.url));
        }
        return NextResponse.next();
    }

    // Se não estiver autenticado, redireciona para login
    if (!token) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("callbackUrl", path);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - api routes (handled separately)
         * - public folder
         */
        "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
