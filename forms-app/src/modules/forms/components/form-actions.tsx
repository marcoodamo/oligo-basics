"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { publishForm, deleteForm } from "@/modules/forms/actions/form-actions";
import { toast } from "sonner";

interface FormActionsProps {
    formId: string;
    status: string;
}

export function FormActions({ formId, status }: FormActionsProps) {
    const router = useRouter();
    const [isPublishing, setIsPublishing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const isPublished = status === "PUBLISHED";

    const handlePublish = async () => {
        setIsPublishing(true);
        try {
            await publishForm(formId, !isPublished);
            toast.success(isPublished ? "Formulário despublicado" : "Formulário publicado!");
        } catch (error) {
            toast.error("Erro ao alterar status");
        } finally {
            setIsPublishing(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteForm(formId);
            toast.success("Formulário excluído");
            router.push("/forms");
        } catch (error) {
            toast.error("Erro ao excluir formulário");
            setIsDeleting(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Button
                variant={isPublished ? "secondary" : "default"}
                size="sm"
                onClick={handlePublish}
                disabled={isPublishing}
            >
                <Power className="mr-2 h-4 w-4" />
                {isPublishing
                    ? "..."
                    : isPublished
                        ? "Despublicar"
                        : "Publicar"}
            </Button>

            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir Formulário</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja excluir este formulário? Esta ação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteDialog(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Excluindo..." : "Excluir"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
