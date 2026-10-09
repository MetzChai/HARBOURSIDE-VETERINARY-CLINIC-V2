"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
  keywords?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  className,
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);

  // React binds `wheel` as a passive listener on root/portal containers, so
  // preventDefault() inside the JSX onWheel handler is ignored by the browser.
  // Without this, the native scroll would stack on top of the manual scrollTop
  // adjustment in onWheel (double scroll speed) while the dialog is scroll-locked.
  React.useEffect(() => {
    const el = listRef.current;
    if (!open || !el) return;
    const onNativeWheel = (e: WheelEvent) => {
      if (el.scrollHeight > el.clientHeight) e.preventDefault();
    };
    el.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => el.removeEventListener("wheel", onNativeWheel);
  }, [open]);

  const selectedOption = React.useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  const filteredOptions = React.useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase().trim();
    return options.filter((opt) => {
      const labelMatch = opt.label.toLowerCase().includes(q);
      const sublabelMatch = opt.sublabel?.toLowerCase().includes(q);
      const keywordsMatch = opt.keywords?.toLowerCase().includes(q);
      return labelMatch || sublabelMatch || keywordsMatch;
    });
  }, [options, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal text-left h-10 px-3", className)}
        >
          <span className="truncate">
            {selectedOption ? (
              <span>
                <span className="font-medium text-foreground">{selectedOption.label}</span>
                {selectedOption.sublabel && (
                  <span className="text-muted-foreground ml-2 text-xs font-normal">
                    ({selectedOption.sublabel})
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {value && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="p-0.5 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
                title="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-2 z-50 bg-popover text-popover-foreground border shadow-md rounded-md overscroll-contain pointer-events-auto"
        align="start"
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        <div
          ref={listRef}
          className="max-h-60 overflow-y-auto overscroll-contain pointer-events-auto space-y-0.5 pr-1"
          onWheel={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight > el.clientHeight) {
              e.stopPropagation();
              el.scrollTop += e.deltaY;
              if (
                (e.deltaY < 0 && el.scrollTop > 0) ||
                (e.deltaY > 0 && el.scrollTop + el.clientHeight < el.scrollHeight)
              ) {
                e.preventDefault();
              }
            }
          }}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">{emptyText}</div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = opt.value === value;
              const isDisabled = opt.disabled ?? false;
              return (
                <button
                  type="button"
                  key={opt.value}
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    onChange(opt.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded-md text-sm flex items-center justify-between transition-colors",
                    isDisabled
                      ? "opacity-50 cursor-not-allowed bg-muted/30 text-muted-foreground"
                      : isSelected
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted/80 text-foreground"
                  )}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate font-medium">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-xs text-muted-foreground truncate">{opt.sublabel}</span>
                    )}
                  </div>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-primary ml-2" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
