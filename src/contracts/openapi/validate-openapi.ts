/**
 * Arden.AS — validação estrutural do OpenAPI v1 (ARDEN-FE-003).
 *
 * Verifica os invariantes essenciais de um documento OpenAPI 3.0.x sem depender de
 * um validador externo pesado: campos obrigatórios, operações com respostas, todos
 * os `$ref` resolvíveis para components.schemas, segurança declarada. Retorna a
 * lista de problemas (vazia = válido).
 */

type Json = Record<string, unknown>;

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

function collectRefs(node: unknown, refs: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, refs);
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Json)) {
      if (key === '$ref' && typeof value === 'string') refs.push(value);
      else collectRefs(value, refs);
    }
  }
}

export function validateOpenApiDocument(doc: Json): string[] {
  const problems: string[] = [];

  const openapi = doc.openapi;
  if (typeof openapi !== 'string' || !openapi.startsWith('3.')) {
    problems.push('campo "openapi" ausente ou não é 3.x');
  }

  const info = doc.info as Json | undefined;
  if (!info?.title) problems.push('info.title ausente');
  if (!info?.version) problems.push('info.version ausente');

  const components = doc.components as Json | undefined;
  const schemas = (components?.schemas as Json | undefined) ?? {};
  if (Object.keys(schemas).length === 0) problems.push('components.schemas vazio');
  if (!(components?.securitySchemes as Json | undefined)?.bearerAuth) {
    problems.push('components.securitySchemes.bearerAuth ausente');
  }

  const paths = doc.paths as Json | undefined;
  if (!paths || Object.keys(paths).length === 0) {
    problems.push('paths vazio');
    return problems;
  }

  const seenOperationIds = new Set<string>();
  for (const [path, itemUnknown] of Object.entries(paths)) {
    const item = itemUnknown as Json;
    const methods = Object.keys(item).filter((k) => HTTP_METHODS.includes(k));
    if (methods.length === 0) problems.push(`${path}: sem operações HTTP`);
    for (const method of methods) {
      const op = item[method] as Json;
      const where = `${method.toUpperCase()} ${path}`;
      if (!op.operationId) problems.push(`${where}: operationId ausente`);
      else {
        const id = String(op.operationId);
        if (seenOperationIds.has(id)) problems.push(`${where}: operationId duplicado (${id})`);
        seenOperationIds.add(id);
      }
      const responses = op.responses as Json | undefined;
      if (!responses || Object.keys(responses).length === 0) {
        problems.push(`${where}: sem responses`);
      } else {
        const hasSuccess = Object.keys(responses).some((s) => s.startsWith('2'));
        if (!hasSuccess) problems.push(`${where}: sem resposta de sucesso (2xx)`);
      }
      if (!op.security) problems.push(`${where}: sem security`);
    }
  }

  // Todos os $ref devem resolver para components.schemas.
  const refs: string[] = [];
  collectRefs(paths, refs);
  const prefix = '#/components/schemas/';
  for (const ref of refs) {
    if (!ref.startsWith(prefix)) {
      problems.push(`$ref não suportado: ${ref}`);
      continue;
    }
    const name = ref.slice(prefix.length);
    if (!(name in schemas)) problems.push(`$ref não resolvido: ${ref}`);
  }

  return problems;
}
