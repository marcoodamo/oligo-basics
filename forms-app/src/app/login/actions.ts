"use server";

import { unstable_rethrow } from "next/navigation";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export type LoginState = { error?: string };

export async function loginAction(
    _prevState: LoginState,
    formData: FormData,
): Promise<LoginState> {
    const redirectTo = (formData.get("redirectTo") as string) || "/dashboard";
    const finalRedirect = redirectTo === "/" ? "/dashboard" : redirectTo;

    formData.set("redirectTo", finalRedirect);

    try {
        console.log("[LOGIN_ACTION] Attempting sign in with credentials...");
        await signIn("credentials", formData);
        console.log("[LOGIN_ACTION] Sign in successful (should have redirected)");
        return {};
    } catch (error) {
        console.log("[LOGIN_ACTION] Error caught:", error);

        // signIn em sucesso chama redirect() — repassar para não engolir
        unstable_rethrow(error);

        if (error instanceof AuthError) {
            console.error("[LOGIN_ACTION] AuthError type:", error.type);
            if (error.type === "CredentialsSignin") {
                return { error: "Email ou senha inválidos" };
            }
        }

        console.error("[LOGIN_ACTION] Unknown error:", error);
        return { error: "Erro ao fazer login" };
    }
}
