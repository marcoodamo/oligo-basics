'use client';

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { vendorLogin } from '@/modules/vendor/actions/auth-actions';

function VendorLoginForm() {
    const router = useRouter();
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
            await vendorLogin({ email, password });
            toast.success('Login realizado com sucesso!');
            router.push('/vendor');
        } catch (error) {
            console.error('[LOGIN] Exception:', error);
            toast.error(error instanceof Error ? error.message : 'Credenciais inválidas');
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
                    <CardTitle className="text-2xl font-bold">Portal do Vendedor</CardTitle>
                    <CardDescription>Faça login para gerenciar seus pedidos</CardDescription>
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
                    <CardTitle className="text-2xl font-bold">Portal do Vendedor</CardTitle>
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

export default function VendorLoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Suspense fallback={<LoginFallback />}>
                <VendorLoginForm />
            </Suspense>
        </div>
    );
}
