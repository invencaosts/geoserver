import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  LayoutGrid,
  Map,
  ShieldAlert,
  Database,
  Users,
  FileText,
  Landmark,
} from "lucide-react";
import type { Permission } from "@geo/shared";

export interface NavItem {
  href: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  permission: Permission;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/mapa",
    label: "Mapa & Camadas",
    subtitle: "Visualização geoespacial e gestão de camadas",
    icon: Map,
    permission: "layer:read",
  },
  {
    href: "/casos",
    label: "Casos de Grilagem",
    subtitle: "Gestão colaborativa e workflow de validação",
    icon: ShieldAlert,
    permission: "case:read",
  },
  {
    href: "/dados",
    label: "Dados Espaciais",
    subtitle: "Importação e processamento de dados geográficos",
    icon: Database,
    permission: "dataset:read",
  },
  {
    href: "/importar-exportar",
    label: "Importar & Exportar",
    subtitle: "Operações de entrada e saída de dados espaciais",
    icon: ArrowLeftRight,
    permission: "dataset:write",
  },
  {
    href: "/timeline",
    label: "Linha do Tempo",
    subtitle: "Marcos legais da propriedade da terra e da questão ambiental no Brasil",
    icon: Landmark,
    permission: "layer:read",
  },
  {
    href: "/relatorios",
    label: "Relatórios",
    subtitle: "Exportação de dados em CSV e PDF",
    icon: FileText,
    permission: "case:read",
  },
  {
    href: "/usuarios",
    label: "Usuários",
    subtitle: "Controle de acesso baseado em papéis",
    icon: Users,
    permission: "user:manage",
  },
];

export const HOME_ICON = LayoutGrid;
