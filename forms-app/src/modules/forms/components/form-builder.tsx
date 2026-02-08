"use client";

import { useState } from "react";
import { Plus, GripVertical, Trash2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { updateFormFields } from "@/modules/forms/actions/form-actions";
import { toast } from "sonner";
import type { FormField, FieldType } from "../types";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
    { value: "text", label: "Texto Curto" },
    { value: "textarea", label: "Texto Longo" },
    { value: "number", label: "Número" },
    { value: "email", label: "Email" },
    { value: "phone", label: "Telefone" },
    { value: "date", label: "Data" },
    { value: "select", label: "Lista Suspensa" },
    { value: "single_choice", label: "Escolha Única" },
    { value: "multiple_choice", label: "Múltipla Escolha" },
    { value: "checkbox", label: "Caixa de Seleção" },
];

interface FormBuilderProps {
    formId: string;
    initialFields: FormField[];
}

export function FormBuilder({ formId, initialFields }: FormBuilderProps) {
    const [fields, setFields] = useState<FormField[]>(initialFields);
    const [isSaving, setIsSaving] = useState(false);
    const [editingField, setEditingField] = useState<FormField | null>(null);

    const addField = (type: FieldType) => {
        const newField: FormField = {
            id: crypto.randomUUID(),
            type,
            label: `Novo Campo ${type}`,
            required: false,
            order: fields.length,
            options: type === "select" || type === "single_choice" || type === "multiple_choice" ? ["Opção 1", "Opção 2"] : undefined,
        };
        setFields([...fields, newField]);
    };

    const updateField = (fieldId: string, updates: Partial<FormField>) => {
        setFields(fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
    };

    const removeField = (fieldId: string) => {
        setFields(fields.filter(f => f.id !== fieldId));
    };

    const saveFields = async () => {
        setIsSaving(true);
        try {
            await updateFormFields(formId, fields);
            toast.success("Campos salvos com sucesso!");
        } catch (error) {
            toast.error("Erro ao salvar campos");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Field List */}
            {fields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhum campo adicionado ainda.</p>
                    <p className="text-sm">Use os botões abaixo para adicionar campos.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {fields.map((field, index) => (
                        <Card key={field.id} className="group">
                            <CardContent className="flex items-center gap-3 p-3">
                                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{field.label}</span>
                                        {field.required && (
                                            <span className="text-xs text-red-500">*</span>
                                        )}
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {FIELD_TYPES.find(t => t.value === field.type)?.label}
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingField(field)}
                                >
                                    <Settings className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive"
                                    onClick={() => removeField(field.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add Field Buttons */}
            <div className="flex flex-wrap gap-2 pt-4 border-t">
                {FIELD_TYPES.map((type) => (
                    <Button
                        key={type.value}
                        variant="outline"
                        size="sm"
                        onClick={() => addField(type.value)}
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        {type.label}
                    </Button>
                ))}
            </div>

            {/* Save Button */}
            <div className="pt-4">
                <Button onClick={saveFields} disabled={isSaving}>
                    {isSaving ? "Salvando..." : "Salvar Campos"}
                </Button>
            </div>

            {/* Edit Field Dialog */}
            <Dialog open={!!editingField} onOpenChange={(open) => !open && setEditingField(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Campo</DialogTitle>
                    </DialogHeader>
                    {editingField && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Rótulo</Label>
                                <Input
                                    value={editingField.label}
                                    onChange={(e) => {
                                        updateField(editingField.id, { label: e.target.value });
                                        setEditingField({ ...editingField, label: e.target.value });
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Placeholder</Label>
                                <Input
                                    value={editingField.placeholder || ""}
                                    onChange={(e) => {
                                        updateField(editingField.id, { placeholder: e.target.value });
                                        setEditingField({ ...editingField, placeholder: e.target.value });
                                    }}
                                    placeholder="Texto de exemplo..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Descrição</Label>
                                <Input
                                    value={editingField.fieldDescription || ""}
                                    onChange={(e) => {
                                        updateField(editingField.id, { fieldDescription: e.target.value });
                                        setEditingField({ ...editingField, fieldDescription: e.target.value });
                                    }}
                                    placeholder="Instruções adicionais..."
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="required"
                                    checked={editingField.required}
                                    onCheckedChange={(checked) => {
                                        updateField(editingField.id, { required: !!checked });
                                        setEditingField({ ...editingField, required: !!checked });
                                    }}
                                />
                                <Label htmlFor="required">Campo obrigatório</Label>
                            </div>
                            {(editingField.type === "select" || editingField.type === "single_choice" || editingField.type === "multiple_choice") && (
                                <div className="space-y-2">
                                    <Label>Opções (uma por linha)</Label>
                                    <textarea
                                        className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                                        value={(editingField.options || []).join("\n")}
                                        onChange={(e) => {
                                            const options = e.target.value.split("\n").filter(Boolean);
                                            updateField(editingField.id, { options });
                                            setEditingField({ ...editingField, options });
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setEditingField(null)}>Concluir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
