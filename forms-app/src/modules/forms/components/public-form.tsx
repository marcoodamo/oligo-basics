"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitFormResponse } from "@/modules/forms/actions/form-actions";
import { toast } from "sonner";
import { CheckCircle } from "lucide-react";
import type { FormField, FormSettings } from "../types";

interface PublicFormProps {
    formId: string;
    fields: FormField[];
    settings: FormSettings;
}

export function PublicForm({ formId, fields, settings }: PublicFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [formData, setFormData] = useState<Record<string, any>>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const result = await submitFormResponse(formId, formData);
            if (result.success) {
                setIsSubmitted(true);
                toast.success("Formulário enviado com sucesso!");
            } else {
                toast.error(result.message || "Erro ao enviar formulário");
            }
        } catch (error) {
            toast.error("Erro ao enviar formulário");
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateField = (fieldId: string, value: any) => {
        setFormData({ ...formData, [fieldId]: value });
    };

    if (isSubmitted) {
        return (
            <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">
                    {settings.thankYouTitle || "Obrigado!"}
                </h2>
                <p className="text-muted-foreground">
                    {settings.thankYouMessage || "Sua resposta foi enviada com sucesso."}
                </p>
                {settings.allowResubmission && (
                    <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => {
                            setIsSubmitted(false);
                            setFormData({});
                        }}
                    >
                        Enviar outra resposta
                    </Button>
                )}
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {fields
                .sort((a, b) => a.order - b.order)
                .map((field) => (
                    <div key={field.id} className="space-y-2">
                        <Label>
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        {field.fieldDescription && (
                            <p className="text-sm text-muted-foreground">{field.fieldDescription}</p>
                        )}

                        {field.type === "text" && (
                            <Input
                                placeholder={field.placeholder}
                                value={formData[field.id] || ""}
                                onChange={(e) => updateField(field.id, e.target.value)}
                                required={field.required}
                            />
                        )}

                        {field.type === "email" && (
                            <Input
                                type="email"
                                placeholder={field.placeholder || "email@exemplo.com"}
                                value={formData[field.id] || ""}
                                onChange={(e) => updateField(field.id, e.target.value)}
                                required={field.required}
                            />
                        )}

                        {field.type === "phone" && (
                            <Input
                                type="tel"
                                placeholder={field.placeholder || "(00) 00000-0000"}
                                value={formData[field.id] || ""}
                                onChange={(e) => updateField(field.id, e.target.value)}
                                required={field.required}
                            />
                        )}

                        {field.type === "number" && (
                            <Input
                                type="number"
                                placeholder={field.placeholder}
                                value={formData[field.id] || ""}
                                onChange={(e) => updateField(field.id, e.target.value)}
                                required={field.required}
                            />
                        )}

                        {field.type === "date" && (
                            <Input
                                type="date"
                                value={formData[field.id] || ""}
                                onChange={(e) => updateField(field.id, e.target.value)}
                                required={field.required}
                            />
                        )}

                        {field.type === "textarea" && (
                            <Textarea
                                placeholder={field.placeholder}
                                value={formData[field.id] || ""}
                                onChange={(e) => updateField(field.id, e.target.value)}
                                required={field.required}
                                rows={4}
                            />
                        )}

                        {field.type === "select" && (
                            <Select
                                value={formData[field.id] || ""}
                                onValueChange={(value) => updateField(field.id, value)}
                                required={field.required}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {(field.options || []).map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        {field.type === "single_choice" && (
                            <RadioGroup
                                value={formData[field.id] || ""}
                                onValueChange={(value) => updateField(field.id, value)}
                            >
                                {(field.options || []).map((option) => (
                                    <div key={option} className="flex items-center space-x-2">
                                        <RadioGroupItem value={option} id={`${field.id}-${option}`} />
                                        <Label htmlFor={`${field.id}-${option}`} className="font-normal">
                                            {option}
                                        </Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        )}

                        {field.type === "multiple_choice" && (
                            <div className="space-y-2">
                                {(field.options || []).map((option) => {
                                    const selected = (formData[field.id] || []) as string[];
                                    return (
                                        <div key={option} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`${field.id}-${option}`}
                                                checked={selected.includes(option)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        updateField(field.id, [...selected, option]);
                                                    } else {
                                                        updateField(
                                                            field.id,
                                                            selected.filter((o) => o !== option)
                                                        );
                                                    }
                                                }}
                                            />
                                            <Label htmlFor={`${field.id}-${option}`} className="font-normal">
                                                {option}
                                            </Label>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {field.type === "checkbox" && (
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id={field.id}
                                    checked={formData[field.id] || false}
                                    onCheckedChange={(checked) => updateField(field.id, checked)}
                                    required={field.required}
                                />
                                <Label htmlFor={field.id} className="font-normal">
                                    {field.placeholder || "Sim"}
                                </Label>
                            </div>
                        )}
                    </div>
                ))}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Enviando..." : "Enviar"}
            </Button>
        </form>
    );
}
