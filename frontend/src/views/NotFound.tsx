"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const pathname = usePathname();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", pathname);
  }, [pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center max-w-sm">
        <BrandLogo size="lg" className="justify-center mb-6" />
        <h1 className="font-heading text-5xl font-bold text-brand-navy mb-2">404</h1>
        <p className="text-muted-foreground mb-6">This page could not be found.</p>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/login">Return to login</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
