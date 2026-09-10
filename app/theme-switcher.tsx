"use client";

import { useSyncExternalStore } from "react";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const options = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Dispositivo", icon: Laptop },
] as const;

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const selected = options.find((option) => option.value === (mounted ? theme : "system")) ?? options[2];
  const Icon = selected.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="theme-trigger" aria-label="Alterar tema da interface">
        <Icon aria-hidden="true" />
        <span>{selected.label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="theme-menu">
        <DropdownMenuLabel>Aparência</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => {
          const OptionIcon = option.icon;
          return (
            <DropdownMenuItem key={option.value} onClick={() => setTheme(option.value)} className="theme-option">
              <OptionIcon aria-hidden="true" />
              <span>{option.label}</span>
              {theme === option.value ? <span className="theme-check" aria-label="Selecionado">•</span> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
