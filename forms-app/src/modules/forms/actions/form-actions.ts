'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { FormField, FormSettings } from '../types';

const FormSchema = z.object({
    title: z.string().min(1, 'Título é obrigatório'),
    description: z.string().optional(),
});

export async function createForm(prevState: any, formData: FormData) {
    const session = await auth();

    if (!session?.user?.organizationId) {
        return { message: 'Não autorizado' };
    }

    const validatedFields = FormSchema.safeParse({
        title: formData.get('title'),
        description: formData.get('description'),
    });

    if (!validatedFields.success) {
        return { message: 'Campos inválidos' };
    }

    const { title, description } = validatedFields.data;

    // Generate a simple slug
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(7);

    try {
        await prisma.form.create({
            data: {
                title,
                description,
                publicSlug: slug,
                organizationId: session.user.organizationId,
                fields: [],
                status: 'DRAFT',
            },
        });
    } catch (error) {
        console.error(error);
        return { message: 'Erro ao criar formulário.' };
    }

    revalidatePath('/forms');
    redirect('/forms');
}

export async function getForm(formId: string) {
    const session = await auth();

    if (!session?.user?.organizationId) {
        return null;
    }

    const form = await prisma.form.findFirst({
        where: {
            id: formId,
            organizationId: session.user.organizationId,
        },
    });

    return form;
}

export async function getForms() {
    const session = await auth();

    if (!session?.user?.organizationId) {
        return [];
    }

    const forms = await prisma.form.findMany({
        where: { organizationId: session.user.organizationId },
        orderBy: { createdAt: 'desc' },
    });

    return forms;
}

export async function getFormBySlug(slug: string) {
    return prisma.form.findUnique({
        where: { publicSlug: slug },
    });
}

export async function updateFormFields(formId: string, fields: FormField[]) {
    const session = await auth();

    if (!session?.user?.organizationId) {
        throw new Error('Não autorizado');
    }

    await prisma.form.update({
        where: { id: formId },
        data: { fields: fields as any },
    });

    revalidatePath(`/forms/${formId}`);
}

export async function updateFormSettings(formId: string, settings: FormSettings & { title?: string; description?: string; publicSlug?: string }) {
    const session = await auth();

    if (!session?.user?.organizationId) {
        throw new Error('Não autorizado');
    }

    const updateData: any = { settings: settings as any };

    if (settings.title !== undefined) {
        updateData.title = settings.title;
    }

    if (settings.description !== undefined) {
        updateData.description = settings.description;
    }

    if (settings.publicSlug !== undefined) {
        const existingForm = await prisma.form.findFirst({
            where: {
                publicSlug: settings.publicSlug,
                id: { not: formId }
            }
        });
        if (existingForm) {
            throw new Error('Slug já está em uso por outro formulário');
        }
        updateData.publicSlug = settings.publicSlug;
    }

    if (settings.emailNotifications !== undefined) {
        updateData.emailNotifications = settings.emailNotifications;
    }
    if (settings.notifyEmail !== undefined) {
        updateData.notifyEmail = settings.notifyEmail;
    }

    await prisma.form.update({
        where: { id: formId },
        data: updateData,
    });

    revalidatePath(`/forms/${formId}`);
    return { success: true };
}

export async function deleteForm(formId: string) {
    const session = await auth();

    if (!session?.user?.organizationId) {
        throw new Error('Não autorizado');
    }

    await prisma.form.delete({
        where: { id: formId },
    });

    revalidatePath('/forms');
    redirect('/forms');
}

export async function publishForm(formId: string, isPublished: boolean) {
    const session = await auth();

    if (!session?.user?.organizationId) {
        throw new Error('Não autorizado');
    }

    await prisma.form.update({
        where: { id: formId },
        data: { status: isPublished ? 'PUBLISHED' : 'DRAFT' },
    });

    revalidatePath(`/forms/${formId}`);
}

export async function submitFormResponse(formId: string, data: Record<string, any>) {
    try {
        await prisma.submission.create({
            data: {
                formId,
                data,
            },
        });

        return { success: true };
    } catch (error) {
        console.error('Submission error:', error);
        return { success: false, message: 'Falha ao enviar formulário' };
    }
}

export async function getFormSubmissions(formId: string) {
    const session = await auth();

    if (!session?.user?.organizationId) {
        return [];
    }

    const form = await prisma.form.findFirst({
        where: {
            id: formId,
            organizationId: session.user.organizationId,
        },
    });

    if (!form) {
        return [];
    }

    const submissions = await prisma.submission.findMany({
        where: { formId },
        orderBy: { createdAt: 'desc' },
    });

    return submissions;
}
