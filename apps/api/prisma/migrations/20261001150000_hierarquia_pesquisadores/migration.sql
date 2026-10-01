-- Nova hierarquia: admin > verificador > pesquisador (envio e download) > pesquisador (envio) > visualizador.
-- "leitor" vira "visualizador"; "contribuidor" deixa de existir e essas contas também viram "visualizador",
-- até um admin ou verificador definir o novo papel. A solicitação de papel no cadastro sai junto.

-- AlterTable
ALTER TABLE "users" DROP COLUMN "requestedRole",
DROP COLUMN "roleApprovalStatus",
DROP COLUMN "perfilContribuidor";

-- DropEnum
DROP TYPE "RoleApprovalStatus";

-- DropEnum
DROP TYPE "PerfilContribuidor";

-- AlterEnum
CREATE TYPE "RoleName_new" AS ENUM ('admin', 'verificador', 'pesquisador_envio_download', 'pesquisador_envio', 'visualizador');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "RoleName_new" USING (
  CASE "role"::text
    WHEN 'leitor' THEN 'visualizador'
    WHEN 'contribuidor' THEN 'visualizador'
    ELSE "role"::text
  END
)::"RoleName_new";
DROP TYPE "RoleName";
ALTER TYPE "RoleName_new" RENAME TO "RoleName";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'visualizador';
