export type UserRole =
  | "owner"
  | "admin"
  | "operations_lead"
  | "commercial_lead"
  | "operator"
  | "sales_rep"
  | "viewer";

/**
 * 01. Validação centralizada de permissões para a Fábrica de Produtos (Módulo 01)
 */
export function canWriteProductFactory(role: string): boolean {
  return ["owner", "admin", "operations_lead", "operator"].includes(role);
}

export function canApproveProduct(role: string): boolean {
  return ["owner", "admin", "operations_lead"].includes(role);
}

export function canApproveCapacityPricing(role: string): boolean {
  return ["owner", "admin", "operations_lead", "commercial_lead"].includes(role);
}

/**
 * 02. Validação centralizada de permissões para Comercial & CRM (Módulo 02)
 */
export function canWriteCommercial(role: string): boolean {
  return ["owner", "admin", "commercial_lead", "sales_rep", "operator"].includes(role);
}

export function canReviewSales(role: string): boolean {
  return ["owner", "admin", "commercial_lead", "sales_rep"].includes(role);
}

export function canAcceptProposal(role: string): boolean {
  return ["owner", "admin", "commercial_lead", "sales_rep"].includes(role);
}

export function canCreateSalesHandoff(role: string): boolean {
  return ["owner", "admin", "commercial_lead", "sales_rep"].includes(role);
}

/**
 * 03. Validação centralizada de permissões para Onboarding de Clientes (Módulo 03)
 */
export function canWriteOnboarding(role: string): boolean {
  return ["owner", "admin", "operations_lead", "operator"].includes(role);
}

export function canReviewOperations(role: string): boolean {
  return ["owner", "admin", "operations_lead"].includes(role);
}

export function canCancelOnboarding(role: string): boolean {
  return ["owner", "admin", "operations_lead"].includes(role);
}

export function canUnblockOnboarding(role: string): boolean {
  return ["owner", "admin", "operations_lead"].includes(role);
}

export function canApproveActivation(role: string): boolean {
  return ["owner", "admin", "operations_lead"].includes(role);
}

/**
 * 04. Segregação de Funções (SoD) na Ativação de Clientes
 * Operadores não possuem permissão para autoaprovação de ativações.
 * Apenas liderança (owner, admin, operations_lead) pode aprovar formalmente.
 */
export function validateActivationApprovalPermission(params: {
  actorRole: string;
  actorId: string;
  assignedOperatorActorId?: string | null;
  createdByActorId?: string | null;
}): { allowed: boolean; reason?: string } {
  const { actorRole } = params;

  if (!canApproveActivation(actorRole)) {
    return {
      allowed: false,
      reason: "Operadores não possuem permissão para aprovar ativação de clientes. Papel requerido: owner, admin ou operations_lead.",
    };
  }

  // Segregação adicional defensiva: se o papel for operator, recusa terminantemente
  if (actorRole === "operator") {
    return {
      allowed: false,
      reason: "Segregação de funções violada: operador não pode aprovar ativação.",
    };
  }

  return { allowed: true };
}

/**
 * 05. Validação centralizada de permissões para o Motor de Operações (Módulo 04)
 */
export function canWriteOperations(role: string): boolean {
  return ["owner", "admin", "operations_lead", "operator"].includes(role);
}

export function canApproveWorkItem(role: string): boolean {
  return ["owner", "admin", "operations_lead"].includes(role);
}

export function canManageWorkflowTemplates(role: string): boolean {
  return ["owner", "admin", "operations_lead"].includes(role);
}

export function hasModulePermission(
  role: string,
  module: "product_factory" | "commercial" | "onboarding" | "operations",
  action: "view" | "create" | "edit" | "approve" | "delete"
): boolean {
  if (["owner", "admin"].includes(role)) return true;

  if (module === "operations") {
    if (action === "view") return true;
    if (action === "create" || action === "edit") {
      return ["operations_lead", "operator"].includes(role);
    }
    if (action === "approve") {
      return role === "operations_lead";
    }
    return false;
  }

  if (module === "onboarding") {
    if (action === "view") return true;
    if (action === "create" || action === "edit") {
      return ["operations_lead", "operator"].includes(role);
    }
    if (action === "approve") {
      return role === "operations_lead";
    }
    return false;
  }

  return true;
}

/**
 * 07. Validação centralizada de permissões para Sucesso do Cliente (Módulo 07)
 */
export function canWriteClientSuccess(role: string): boolean {
  return ["owner", "admin", "operations_lead", "commercial_lead", "operator"].includes(role);
}

export function canApproveClientSuccess(role: string): boolean {
  return ["owner", "admin", "operations_lead", "commercial_lead"].includes(role);
}

/**
 * 09. Validação centralizada de permissões para Integrações e Automação (Módulo 09)
 * Operadores e visualizadores NUNCA possuem permissão para aprovar ou executar escritas externas.
 * Apenas a liderança operacional (owner, admin, operations_lead) pode aprovar ou autorizar a execução.
 */
export function canApproveAutomationWrite(role: string): boolean {
  return ["owner", "admin", "operations_lead"].includes(role);
}

export function canExecuteAutomationWrite(role: string): boolean {
  return ["owner", "admin", "operations_lead"].includes(role);
}

export function canManageAutomationQueue(role: string): boolean {
  return ["owner", "admin", "operations_lead", "operator"].includes(role);
}



