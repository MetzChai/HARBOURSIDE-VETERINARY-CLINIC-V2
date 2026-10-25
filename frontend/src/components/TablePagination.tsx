"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
}

export function TablePagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = "entries",
  className = "",
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground ${className}`}>
      {/* Left: Range and Page Size Selector */}
      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <span>
          Showing <strong className="font-semibold text-foreground">{startItem}</strong> to{" "}
          <strong className="font-semibold text-foreground">{endItem}</strong> of{" "}
          <strong className="font-semibold text-foreground">{totalItems}</strong> {itemLabel}
        </span>

        <div className="flex items-center gap-1.5">
          <span className="text-xs">Show</span>
          <Select
            value={String(pageSize)}
            onValueChange={(val) => {
              onPageSizeChange(Number(val));
              onPageChange(1);
            }}
          >
            <SelectTrigger className="h-7 w-[68px] text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((opt) => (
                <SelectItem key={opt} value={String(opt)} className="text-xs">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs">entries</span>
        </div>
      </div>

      {/* Right: Page Navigation Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs gap-1"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </Button>

        <span className="px-2 font-medium text-foreground">
          Page {currentPage} of {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs gap-1"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
