import {
  CASE_FORM_SCHEMA_VERSION,
  LEGACY_VALIDATED_CASE_SCHEMA_VERSION,
  type AuthUser,
} from "@geo/shared";
import type { Dataset, Prisma } from "@prisma/client";

export function isDatasetReviewer(user?: AuthUser) {
  return user?.role === "admin" || user?.role === "verificador";
}

export function canReadRestrictedDataset(user?: AuthUser) {
  return isDatasetReviewer(user);
}

const publicCaseWhere: Prisma.CaseWhereInput = {
  status: "validado",
  OR: [
    // Casos já validados antes do formulário novo preservam a publicação histórica,
    // mas as APIs de caso/dataset entregam apenas suas projeções públicas reduzidas.
    { formSchemaVersion: null },
    { formSchemaVersion: LEGACY_VALIDATED_CASE_SCHEMA_VERSION },
    {
      formSchemaVersion: CASE_FORM_SCHEMA_VERSION,
      contribution: {
        is: {
          grauPublicidadeInformacoes: "publico",
          possuiRestricaoDivulgacao: false,
        },
      },
    },
  ],
};

export function datasetAccessWhere(user?: AuthUser): Prisma.DatasetWhereInput {
  if (isDatasetReviewer(user)) return {};
  const publicDataset: Prisma.DatasetWhereInput = {
    visibility: "publico",
    OR: [{ caseId: null }, { case: publicCaseWhere }],
  };
  if (!user) return publicDataset;
  return canReadRestrictedDataset(user) ? {} : { OR: [{ createdById: user.id }, publicDataset] };
}

export function canReadDataset(
  dataset: Pick<Dataset, "createdById" | "visibility" | "caseId">,
  linkedCase?: {
    status: string;
    formSchemaVersion?: string | null;
    contribution?: {
      grauPublicidadeInformacoes: string | null;
      possuiRestricaoDivulgacao: boolean | null;
    } | null;
  } | null,
  user?: AuthUser,
) {
  if (isDatasetReviewer(user) || dataset.createdById === user?.id) return true;
  const isLegacyPublishedCase =
    linkedCase?.formSchemaVersion === null ||
    linkedCase?.formSchemaVersion === LEGACY_VALIDATED_CASE_SCHEMA_VERSION;
  if (
    dataset.caseId &&
    (!linkedCase ||
      linkedCase.status !== "validado" ||
      (!isLegacyPublishedCase &&
        (!linkedCase.contribution ||
          linkedCase.formSchemaVersion !== CASE_FORM_SCHEMA_VERSION ||
          linkedCase.contribution.grauPublicidadeInformacoes !== "publico" ||
          linkedCase.contribution.possuiRestricaoDivulgacao !== false)))
  ) {
    return false;
  }
  return dataset.visibility === "publico";
}
