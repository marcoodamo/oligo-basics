"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createForm } from "@/modules/forms/actions/form-actions";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const initialState = {
    message: "",
};

export default function NewFormPage() {
    const router = useRouter();
    const [state, formAction, isPending] = useActionState(createForm, initialState);

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/forms">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Novo Formulário</h1>
                    <p className="text-muted-foreground">
                        Crie um novo formulário de pedidos
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Informações Básicas</CardTitle>
                    <CardDescription>
                        Defina o título e descrição do seu formulário
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={formAction} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Título *</Label>
                            <Input
                                id="title"
                                name="title"
                                placeholder="Ex: Pedido de Vendas"
                                required
                                disabled={isPending}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Descrição</Label>
                            <Textarea
                                id="description"
                                name="description"
                                placeholder="Descrição do formulário (opcional)"
                                rows={3}
                                disabled={isPending}
                            />
                        </div>

                        {state?.message && (
                            <p className="text-sm text-destructive">{state.message}</p>
                        )}

                        <div className="flex gap-3">
                            <Button type="submit" disabled={isPending}>
                                {isPending ? "Criando..." : "Criar Formulário"}
                            </Button>
                            <Button type="button" variant="outline" onClick={() => router.back()}>
                                Cancelar
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
