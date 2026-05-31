import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { NAV_ITEMS } from "@/lib/nav-registry";

interface Ctx {
  open: boolean;
  setOpen: (v: boolean) => void;
}
const CommandPaletteContext = React.createContext<Ctx | null>(null);

export function useCommandPalette() {
  const ctx = React.useContext(CommandPaletteContext);
  if (!ctx) throw new Error("CommandPalette context missing");
  return ctx;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Group items
  const groups = React.useMemo(() => {
    const g: Record<string, typeof NAV_ITEMS> = {};
    for (const item of NAV_ITEMS) {
      (g[item.group] ||= []).push(item);
    }
    return g;
  }, []);

  const go = (to: string) => {
    setOpen(false);
    navigate({ to });
  };

  return (
    <CommandPaletteContext.Provider value={{ open, setOpen }}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="ابحث في الصفحات والإجراءات..." />
        <CommandList>
          <CommandEmpty>لا توجد نتائج.</CommandEmpty>
          {Object.entries(groups).map(([group, items], idx) => (
            <React.Fragment key={group}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={group}>
                {items.map((item) => (
                  <CommandItem
                    key={item.to}
                    value={`${item.title} ${item.keywords?.join(" ") ?? ""} ${item.to}`}
                    onSelect={() => go(item.to)}
                  >
                    <item.icon className="size-4 ml-2 shrink-0 text-muted-foreground" />
                    <span className="flex-1">{item.title}</span>
                    {item.shortcut && (
                      <kbd className="text-[10px] num text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                        {item.shortcut}
                      </kbd>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </React.Fragment>
          ))}
        </CommandList>
      </CommandDialog>
    </CommandPaletteContext.Provider>
  );
}
