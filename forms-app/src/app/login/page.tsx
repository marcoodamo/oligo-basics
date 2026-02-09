"use client";

import { useState, Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loginAction, type LoginState } from "./actions";

function LoginForm() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

    const [state, formAction, isPending] = useActionState<LoginState, FormData>(
        loginAction,
        {}
    );

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
                <form action={formAction} className="space-y-4">
                    <input type="hidden" name="redirectTo" value={callbackUrl} />

                    {state.error && (
                        <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
                            {state.error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="seu@email.com"
                            required
                            disabled={isPending}
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
                            disabled={isPending}
                            autoComplete="current-password"
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={isPending}>
                        {isPending ? "Entrando..." : "Entrar"}
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
