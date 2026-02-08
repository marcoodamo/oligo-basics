import Link from "next/link";
import { Plus, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getForms } from "@/modules/forms/actions/form-actions";

export default async function FormsPage() {
    const forms = await getForms();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Formulários</h1>
                    <p className="text-muted-foreground">
                        Gerencie seus formulários de pedidos
                    </p>
                </div>
                <Button asChild>
                    <Link href="/forms/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Formulário
                    </Link>
                </Button>
            </div>

            {forms.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Nenhum formulário ainda</h3>
                        <p className="text-muted-foreground text-center mb-4">
                            Crie seu primeiro formulário para começar a receber pedidos
                        </p>
                        <Button asChild>
                            <Link href="/forms/new">
                                <Plus className="mr-2 h-4 w-4" />
                                Criar Formulário
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {forms.map((form) => (
                        <Card key={form.id} className="hover:shadow-md transition-shadow">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-lg">{form.title}</CardTitle>
                                        <CardDescription className="line-clamp-2">
                                            {form.description || "Sem descrição"}
                                        </CardDescription>
                                    </div>
                                    <span
                                        className={`px-2 py-1 text-xs rounded-full ${form.status === "PUBLISHED"
                                                ? "bg-green-100 text-green-800"
                                                : "bg-yellow-100 text-yellow-800"
                                            }`}
                                    >
                                        {form.status === "PUBLISHED" ? "Publicado" : "Rascunho"}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-2">
                                    <Button asChild variant="outline" size="sm" className="flex-1">
                                        <Link href={`/forms/${form.id}`}>Editar</Link>
                                    </Button>
                                    {form.status === "PUBLISHED" && (
                                        <Button asChild variant="ghost" size="sm">
                                            <Link href={`/f/${form.publicSlug}`} target="_blank">
                                                <ExternalLink className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
