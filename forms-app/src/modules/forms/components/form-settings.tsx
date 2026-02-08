"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateFormSettings } from "@/modules/forms/actions/form-actions";
import { toast } from "sonner";
import type { FormSettings as FormSettingsType } from "../types";

interface FormSettingsProps {
    formId: string;
    initialSettings: FormSettingsType & {
        title: string;
        description: string;
        publicSlug: string;
    };
}

export function FormSettings({ formId, initialSettings }: FormSettingsProps) {
    const [settings, setSettings] = useState(initialSettings);
    const [isSaving, setIsSaving] = useState(false);

    const saveSettings = async () => {
        setIsSaving(true);
        try {
            await updateFormSettings(formId, settings);
            toast.success("Configurações salvas!");
        } catch (error: any) {
            toast.error(error.message || "Erro ao salvar configurações");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Configurações Gerais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Título</Label>
                        <Input
                            value={settings.title}
                            onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Textarea
                            value={settings.description || ""}
                            onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                            rows={2}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Slug (URL pública)</Label>
                        <Input
                            value={settings.publicSlug}
                            onChange={(e) => setSettings({ ...settings, publicSlug: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                            /f/{settings.publicSlug}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Notificações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Notificações por Email</Label>
                            <p className="text-xs text-muted-foreground">
                                Receba um email a cada nova resposta
                            </p>
                        </div>
                        <Switch
                            checked={settings.emailNotifications || false}
                            onCheckedChange={(checked) => setSettings({ ...settings, emailNotifications: checked })}
                        />
                    </div>
                    {settings.emailNotifications && (
                        <div className="space-y-2">
                            <Label>Email para notificações</Label>
                            <Input
                                type="email"
                                value={settings.notifyEmail || ""}
                                onChange={(e) => setSettings({ ...settings, notifyEmail: e.target.value })}
                                placeholder="seu@email.com"
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Agradecimento</CardTitle>
                    <CardDescription>
                        Mensagem exibida após envio do formulário
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Título da mensagem</Label>
                        <Input
                            value={settings.thankYouTitle || ""}
                            onChange={(e) => setSettings({ ...settings, thankYouTitle: e.target.value })}
                            placeholder="Obrigado!"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Mensagem de agradecimento</Label>
                        <Textarea
                            value={settings.thankYouMessage || ""}
                            onChange={(e) => setSettings({ ...settings, thankYouMessage: e.target.value })}
                            placeholder="Sua resposta foi enviada com sucesso."
                            rows={3}
                        />
                    </div>
                </CardContent>
            </Card>

            <Button onClick={saveSettings} disabled={isSaving} className="w-full">
                {isSaving ? "Salvando..." : "Salvar Configurações"}
            </Button>
        </div>
    );
}
