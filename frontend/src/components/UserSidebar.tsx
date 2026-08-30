"use client";

import { PawPrint, Calendar, LogOut, LayoutDashboard, Heart, DollarSign, MessageSquare, Bot, UserCircle } from "lucide-react";
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
  { title: "Dashboard", url: "/user", icon: LayoutDashboard },
  { title: "My Pets", url: "/user/pets", icon: PawPrint },
  { title: "Appointments", url: "/user/appointments", icon: Calendar },
  { title: "Records", url: "/user/care-history", icon: Heart },
  { title: "Transactions", url: "/user/transactions", icon: DollarSign },
  { title: "Messages", url: "/user/messages", icon: MessageSquare },
  { title: "Profile", url: "/user/profile", icon: UserCircle },
];

export function UserSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const router = useRouter();
  const { signOut } = useAuth();

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
          subtitle="Pet Owner Portal"
          variant="sidebar"
          collapsed={collapsed}
        />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-wider">
            My Portal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      href={item.url}
                      end={item.url === "/user"}
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
