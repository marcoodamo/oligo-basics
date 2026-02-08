import { Sidebar } from "@/components/shell/sidebar";

export default function ShellLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto">
                <div className="container mx-auto p-6">{children}</div>
            </main>
        </div>
    );
}
