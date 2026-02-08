import { notFound } from "next/navigation";
import { getFormBySlug } from "@/modules/forms/actions/form-actions";
import { PublicForm } from "@/modules/forms/components/public-form";
import Image from "next/image";
import type { FormField, FormSettings } from "@/modules/forms/types";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ slug: string }>;
}

export default async function PublicFormPage({ params }: PageProps) {
    const { slug } = await params;
    const form = await getFormBySlug(slug);

    if (!form || form.status !== "PUBLISHED") {
        notFound();
    }

    const fields = (form.fields as unknown as FormField[]) || [];
    const settings = (form.settings as unknown as FormSettings) || {};

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            {/* Header with logo */}
            <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="container mx-auto px-4 py-3 flex justify-center">
                    <Image
                        src="/logo.png"
                        alt="Oligo Basics"
                        width={120}
                        height={40}
                        className="h-8 w-auto"
                    />
                </div>
            </header>

            {/* Form Content */}
            <main className="container mx-auto px-4 py-8 max-w-2xl">
                <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
                    <div className="mb-6">
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                            {form.title}
                        </h1>
                        {form.description && (
                            <p className="text-slate-600">{form.description}</p>
                        )}
                    </div>

                    <PublicForm
                        formId={form.id}
                        fields={fields}
                        settings={settings}
                    />
                </div>
            </main>

            {/* Footer */}
            <footer className="py-6 text-center text-sm text-slate-500">
                <p>Powered by Oligo Forms</p>
            </footer>
        </div>
    );
}
