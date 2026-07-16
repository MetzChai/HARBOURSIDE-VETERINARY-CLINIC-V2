"use client";

import { PawPrint, Users, Calendar, Heart, Package, FileText, LogOut, LayoutDashboard, Bug, Receipt, MessageSquare } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { BrandLogo } from "@/components/BrandLogo";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
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

const mainItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Manage Pets", url: "/admin/pets", icon: PawPrint },
  { title: "Manage Owners", url: "/admin/owners", icon: Users },
  { title: "Deworming", url: "/admin/dewormings", icon: Bug },
  { title: "Schedule", url: "/admin/schedule", icon: Calendar },
  { title: "Care History", url: "/admin/care-history", icon: Heart },
  { title: "Inventory", url: "/admin/inventory", icon: Package },
  { title: "Lab & Transactions", url: "/admin/transactions", icon: Receipt },
  { title: "Communications", url: "/admin/messages", icon: MessageSquare },
  { title: "Reports", url: "/admin/reports", icon: FileText },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const router = useRouter();
  const { signOut } = useAuth();
  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
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
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      href={item.url}
                      end={item.url === "/admin"}
                      className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
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
