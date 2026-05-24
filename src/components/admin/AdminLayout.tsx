import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";

export default function AdminLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background overflow-x-hidden">
        <AdminSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-12 flex items-center border-b border-border px-4 gap-3">
            <SidebarTrigger />
            <span className="font-display tracking-wider uppercase text-sm">Sherpa Admin</span>
          </header>
          <main className="flex-1 p-4 sm:p-6 overflow-x-hidden overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
