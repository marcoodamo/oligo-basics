import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getForm, getFormSubmissions } from "@/modules/forms/actions/form-actions";
import { FormBuilder } from "@/modules/forms/components/form-builder";
import { FormSettings } from "@/modules/forms/components/form-settings";
import { FormActions } from "@/modules/forms/components/form-actions";
import { SubmissionsList } from "@/modules/forms/components/submissions-list";
import type { FormField, FormSettings as FormSettingsType } from "@/modules/forms/types";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function FormEditorPage({ params }: PageProps) {
    const { id } = await params;
    const form = await getForm(id);

    if (!form) {
        notFound();
    }

    const rawSubmissions = await getFormSubmissions(id);
    const submissions = rawSubmissions.map((s) => ({
        ...s,
        data: (s.data as Record<string, any>) ?? {},
    }));
    const fields = (form.fields as unknown as FormField[]) || [];
    const settings = (form.settings as unknown as FormSettingsType) || {};

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/forms">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">{form.title}</h1>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span
                                className={`px-2 py-0.5 text-xs rounded-full ${form.status === "PUBLISHED"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-yellow-100 text-yellow-800"
                                    }`}
                            >
                                {form.status === "PUBLISHED" ? "Publicado" : "Rascunho"}
                            </span>
                            <span>•</span>
                            <span>{fields.length} campos</span>
                            <span>•</span>
                            <span>{submissions.length} respostas</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {form.status === "PUBLISHED" && (
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/f/${form.publicSlug}`} target="_blank">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Ver Formulário
                            </Link>
                        </Button>
                    )}
                    <FormActions
                        formId={form.id}
                        status={form.status}
                    />
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Form Builder */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Campos do Formulário</CardTitle>
                            <CardDescription>
                                Adicione e organize os campos do formulário
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FormBuilder formId={form.id} initialFields={fields} />
                        </CardContent>
                    </Card>

                    {/* Submissions */}
                    {submissions.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Respostas ({submissions.length})</CardTitle>
                                <CardDescription>
                                    Últimas respostas recebidas
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <SubmissionsList submissions={submissions} fields={fields} />
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar - Settings */}
                <div className="space-y-6">
                    <FormSettings
                        formId={form.id}
                        initialSettings={{
                            ...settings,
                            title: form.title,
                            description: form.description || "",
                            publicSlug: form.publicSlug,
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
