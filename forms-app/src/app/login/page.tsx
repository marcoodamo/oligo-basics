"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const rawCallback = searchParams.get("callbackUrl") || "/dashboard";
    const callbackUrl = rawCallback === "/" ? "/dashboard" : rawCallback;

    const [isLoading, setIsLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        if (!email || !password) {
            toast.error("Por favor, preencha todos os campos");
            setIsLoading(false);
            return;
        }

        try {
            console.log('[LOGIN] Attempting login with:', email);
            const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
            });

            console.log('[LOGIN] Result:', result);

            if (result?.error) {
                console.error('[LOGIN] Error:', result.error);
                toast.error("Email ou senha inválidos");
            } else {
                toast.success("Login realizado com sucesso!");
                console.log('[LOGIN] Success, refreshing and redirecting to:', callbackUrl);
                router.refresh(); // Update server components
                router.replace(callbackUrl); // Use replace to prevent back button loop
            }
        } catch (error) {
            console.error('[LOGIN] Exception:', error);
            toast.error("Erro ao fazer login. Tente novamente.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader className="space-y-4 text-center">
                <div className="flex justify-center">
                    <Image
                        src="/logo.png"
                        alt="Oligo Basics"
                        width={200}
                        height={80}
                        className="h-20 w-auto"
                        priority
                    />
                </div>
                <div>
                    <CardTitle className="text-2xl font-bold">Oligo Forms</CardTitle>
                    <CardDescription>Faça login para acessar o sistema de pedidos</CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="seu@email.com"
                            required
                            disabled={isLoading}
                            autoComplete="email"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Senha</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="••••••••"
                            required
                            disabled={isLoading}
                            autoComplete="current-password"
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? "Entrando..." : "Entrar"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function LoginFallback() {
    return (
        <Card className="w-full max-w-md">
            <CardHeader className="space-y-4 text-center">
                <div className="flex justify-center">
                    <div className="h-20 w-48 bg-muted rounded animate-pulse" />
                </div>
                <div>
                    <CardTitle className="text-2xl font-bold">Oligo Forms</CardTitle>
                    <CardDescription>Carregando...</CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                <div className="animate-pulse space-y-4">
                    <div className="h-10 bg-muted rounded"></div>
                    <div className="h-10 bg-muted rounded"></div>
                    <div className="h-10 bg-muted rounded"></div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function LoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Suspense fallback={<LoginFallback />}>
                <LoginForm />
            </Suspense>
        </div>
    );
}
