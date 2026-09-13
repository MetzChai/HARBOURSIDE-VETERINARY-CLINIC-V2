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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-[#3F080D] text-white shadow-xl">
      <SidebarHeader className="p-4 border-b border-white/10 bg-gradient-to-b from-[#4A0A10] to-[#37060A]">
        <BrandLogo
          size="sm"
          showText
          subtitle="Pet Owner Portal"
          variant="sidebar"
          collapsed={collapsed}
        />
      </SidebarHeader>

      <SidebarContent className="bg-[#3F080D]">
        <SidebarGroup>
          <SidebarGroupLabel className="text-brand-red/90 uppercase text-[10px] tracking-wider font-bold px-3">
            My Pet Portal
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-1.5 pt-1">
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      href={item.url}
                      end={item.url === "/user"}
                      className="text-slate-300 hover:bg-white/10 hover:text-white transition-all rounded-lg my-0.5 px-3 py-2 text-sm flex items-center gap-3"
                      activeClassName="bg-[#E5192C]/20 text-rose-300 font-semibold border-l-4 border-[#E5192C] shadow-sm"
                    >
                      <item.icon className="h-4 w-4 shrink-0 text-brand-red" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-white/10 bg-[#37060A]">
        <SidebarMenu className="space-y-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-slate-300 hover:bg-[#1FA8A8]/20 hover:text-[#1FA8A8] rounded-lg transition-colors"
              onClick={() => {
                const chatBtn = document.querySelector('[data-chat-toggle="true"]') as HTMLButtonElement | null;
                chatBtn?.click();
              }}
            >
              <Bot className="h-4 w-4 shrink-0 text-brand-teal" />
              {!collapsed && <span className="font-medium">PawBot AI</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="text-slate-300 hover:bg-rose-500/20 hover:text-rose-300 rounded-lg transition-colors">
              <LogOut className="h-4 w-4 shrink-0 text-rose-400" />
              {!collapsed && <span>Logout</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
