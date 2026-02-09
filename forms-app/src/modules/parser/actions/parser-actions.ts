"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

interface ParseResult {
    order: any;
    lines: any[];
    warnings: string[];
    document_type: string;
    split_orders?: any[];
    has_multiple_dates?: boolean;
}

export async function saveParserProcessing(
    filename: string,
    fileSize: number,
    result: ParseResult,
    processingTime: number
) {
    const processing = await prisma.parserProcessing.create({
        data: {
            filename,
            fileSize,
            status: result.warnings.some(w => w.includes("failed")) ? "failed" : "success",
            documentType: result.document_type || "unknown",
            orderNumber: result.order?.customer_order_number || null,
            customerName: result.order?.sell_to?.name || result.order?.customer_name || null,
            itemCount: result.lines?.length || 0,
            warningCount: result.warnings?.length || 0,
            resultJson: result as unknown as Prisma.InputJsonValue,
            warnings: result.warnings || [],
            processingTime,
        },
    });

    revalidatePath("/parser");
    return processing;
}

export async function getParserHistory(limit: number = 50) {
    const history = await prisma.parserProcessing.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            filename: true,
            fileSize: true,
            status: true,
            documentType: true,
            orderNumber: true,
            customerName: true,
            itemCount: true,
            warningCount: true,
            processingTime: true,
            createdAt: true,
        },
    });

    return history;
}

export async function getParserProcessingById(id: string) {
    const processing = await prisma.parserProcessing.findUnique({
        where: { id },
    });

    return processing;
}

export async function deleteParserProcessing(id: string) {
    await prisma.parserProcessing.delete({
        where: { id },
    });

    revalidatePath("/parser");
    return { success: true };
}

export async function deleteMultipleProcessings(ids: string[]) {
    await prisma.parserProcessing.deleteMany({
        where: { id: { in: ids } },
    });

    revalidatePath("/parser");
    return { success: true, count: ids.length };
}
