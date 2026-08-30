"use client";

import { PawPrint, Users, Calendar, Heart, Package, FileText, LogOut, LayoutDashboard, Receipt, MessageSquare, UserCog, Bot, Settings } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { BrandLogo } from "@/components/BrandLogo";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/lib/roles";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems: { title: string; url: string; icon: typeof LayoutDashboard; roles: AppRole[] }[] = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard, roles: ["admin", "staff"] },
  { title: "Manage Pets", url: "/admin/pets", icon: PawPrint, roles: ["admin", "staff"] },
  { title: "Manage Owners", url: "/admin/owners", icon: Users, roles: ["admin", "staff"] },
  { title: "Schedule", url: "/admin/schedule", icon: Calendar, roles: ["admin", "staff"] },
  { title: "Care History", url: "/admin/care-history", icon: Heart, roles: ["admin", "staff"] },
  { title: "Inventory", url: "/admin/inventory", icon: Package, roles: ["admin", "staff"] },
  { title: "Lab & Transactions", url: "/admin/transactions", icon: Receipt, roles: ["admin", "staff"] },
  { title: "Communications", url: "/admin/messages", icon: MessageSquare, roles: ["admin", "staff"] },
  { title: "Reports", url: "/admin/reports", icon: FileText, roles: ["admin"] },
  { title: "Staff Management", url: "/admin/staff", icon: UserCog, roles: ["admin"] },
  { title: "Settings", url: "/admin/profile", icon: Settings, roles: ["admin", "staff"] },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const router = useRouter();
  const { signOut, role } = useAuth();
  const visibleItems = mainItems.filter((item) => role && item.roles.includes(role));

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4 border-b border-sidebar-border/50">
        <BrandLogo
          size="sm"
          showText
          subtitle="Veterinary Clinic"
          variant="sidebar"
          collapsed={collapsed}
        />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-wider">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      href={item.url}
                      end={item.url === "/admin"}
                      className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium border-l-2 border-sidebar-primary"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => {
                const chatBtn = document.querySelector('[data-chat-toggle="true"]') as HTMLButtonElement | null;
                chatBtn?.click();
              }}
            >
              <Bot className="h-4 w-4 shrink-0" />
              {!collapsed && <span>PawBot</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="text-sidebar-foreground/70 hover:text-sidebar-accent-foreground">
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Logout</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
