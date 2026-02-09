import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";

const authConfig: NextAuthConfig = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const email = credentials?.email as string;
                const password = credentials?.password as string;

                console.log("[AUTH] Starting authorization...");

                if (!email || !password) {
                    console.log("[AUTH] Missing email or password");
                    return null;
                }

                try {
                    const { prisma } = await import("./prisma");
                    const bcrypt = await import("bcryptjs");

                    console.log("[AUTH] Looking for user:", email);

                    const user = await prisma.user.findUnique({
                        where: { email },
                        include: { organization: true },
                    });

                    if (!user) {
                        console.log("[AUTH] User not found");
                        return null;
                    }

                    if (user.deletedAt) {
                        console.log("[AUTH] User is deleted");
                        return null;
                    }

                    console.log("[AUTH] User found:", user.id);

                    const isValid = await bcrypt.compare(password, user.passwordHash);
                    console.log("[AUTH] Password valid:", isValid);

                    if (!isValid) {
                        console.log("[AUTH] Invalid password");
                        return null;
                    }

                    console.log("[AUTH] Login successful!");

                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name || user.email,
                        role: user.role,
                        organizationId: user.organizationId,
                    };
                } catch (error) {
                    console.error("[AUTH] Error during authorization:", error);
                    return null;
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
                token.organizationId = (user as any).organizationId;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as UserRole;
                session.user.organizationId = token.organizationId as string;
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
    secret: process.env.AUTH_SECRET,
    trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
