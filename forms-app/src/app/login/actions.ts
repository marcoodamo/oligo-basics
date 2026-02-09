"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { cookies } from "next/headers";

export type LoginState = { error?: string };

export async function loginAction(
    _prevState: LoginState,
    formData: FormData,
): Promise<LoginState> {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const redirectTo = (formData.get("redirectTo") as string) || "/dashboard";

    console.log("=".repeat(60));
    console.log("[LOGIN_ACTION] Starting login process...");
    console.log("[LOGIN_ACTION] Email:", email);
    console.log("[LOGIN_ACTION] RedirectTo:", redirectTo);
    console.log("[LOGIN_ACTION] AUTH_SECRET exists:", !!process.env.AUTH_SECRET);
    console.log("[LOGIN_ACTION] NODE_ENV:", process.env.NODE_ENV);
    console.log("[LOGIN_ACTION] AUTH_URL:", process.env.AUTH_URL);
    console.log("[LOGIN_ACTION] NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
    console.log("[LOGIN_ACTION] AUTH_TRUST_HOST:", process.env.AUTH_TRUST_HOST);

    try {
        console.log("[LOGIN_ACTION] Calling signIn with redirect:false...");

        const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        console.log("[LOGIN_ACTION] signIn result:", JSON.stringify(result));
        console.log("[LOGIN_ACTION] Sign in successful!");

        // Log cookies after login
        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll();
        console.log("[LOGIN_ACTION] Cookies after signIn:", allCookies.map(c => c.name));

    } catch (error: any) {
        console.log("[LOGIN_ACTION] Error type:", error?.constructor?.name);
        console.log("[LOGIN_ACTION] Error message:", error?.message);
        console.log("[LOGIN_ACTION] Error:", error);

        if (error instanceof AuthError) {
            console.log("[LOGIN_ACTION] AuthError type:", error.type);
            if (error.type === "CredentialsSignin") {
                return { error: "Email ou senha inválidos" };
            }
        }
        return { error: "Erro ao fazer login" };
    }

    console.log("[LOGIN_ACTION] About to redirect to:", redirectTo);
    console.log("=".repeat(60));

    // Redirect after successful login
    redirect(redirectTo);
}
