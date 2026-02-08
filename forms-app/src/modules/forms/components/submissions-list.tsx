"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { FormField } from "../types";

interface Submission {
    id: string;
    data: Record<string, any>;
    createdAt: Date;
}

interface SubmissionsListProps {
    submissions: Submission[];
    fields: FormField[];
}

export function SubmissionsList({ submissions, fields }: SubmissionsListProps) {
    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(date));
    };

    const getFieldLabel = (fieldId: string) => {
        const field = fields.find(f => f.id === fieldId);
        return field?.label || fieldId;
    };

    return (
        <div className="space-y-3">
            {submissions.slice(0, 10).map((submission) => (
                <Card key={submission.id}>
                    <CardContent className="p-4">
                        <div className="text-xs text-muted-foreground mb-2">
                            {formatDate(submission.createdAt)}
                        </div>
                        <div className="space-y-1">
                            {Object.entries(submission.data).slice(0, 3).map(([key, value]) => (
                                <div key={key} className="text-sm">
                                    <span className="font-medium">{getFieldLabel(key)}:</span>{" "}
                                    <span className="text-muted-foreground">
                                        {Array.isArray(value) ? value.join(", ") : String(value)}
                                    </span>
                                </div>
                            ))}
                            {Object.keys(submission.data).length > 3 && (
                                <div className="text-xs text-muted-foreground">
                                    +{Object.keys(submission.data).length - 3} campos
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}
            {submissions.length > 10 && (
                <p className="text-center text-sm text-muted-foreground">
                    Mostrando 10 de {submissions.length} respostas
                </p>
            )}
        </div>
    );
}
