/**
 * Arden.AS API — bootstrap seguro de organização (ARDEN-BE-002).
 *
 * Executado FORA da API pública (CLI). Cria/localiza usuário + organização +
 * membership ativa e atribui o papel inicial de administrador da organização.
 * Idempotente. Suporta `--dry-run`. Exige confirmação (ou `--yes`). NUNCA recebe
 * senha; NUNCA imprime token. Falha em conflito material (slug com outro nome).
 *
 * Uso:
 *   npm run bootstrap:organization -- \
 *     --name "TheNeil" --slug "theneil" \
 *     --user-subject "<SUBJECT>" --user-email "<EMAIL>" [--provider supabase] \
 *     [--role corporate_admin] [--dry-run] [--yes]
 */

import { createInterface } from 'node:readline';
import { PrismaClient } from '@prisma/client';
import { seedIdentityCatalog } from './seed';

export interface BootstrapInput {
  name: string;
  slug: string;
  userSubject: string;
  userEmail?: string | null;
  provider: string;
  roleKey: string;
}

export interface BootstrapResult {
  dryRun: boolean;
  userId: string | null;
  organizationId: string | null;
  membershipId: string | null;
  created: { user: boolean; organization: boolean; membership: boolean; roleAssignment: boolean };
}

export async function bootstrapOrganization(
  prisma: PrismaClient,
  input: BootstrapInput,
  opts: { dryRun: boolean } = { dryRun: false },
): Promise<BootstrapResult> {
  if (!opts.dryRun) await seedIdentityCatalog(prisma);

  const role = await prisma.role.findFirst({
    where: { organizationId: null, key: input.roleKey, system: true },
  });
  if (!role && !opts.dryRun) {
    throw new Error(`Papel de sistema "${input.roleKey}" inexistente (rode o seed).`);
  }

  // Usuário (por provider + subject; subject é imutável).
  let user = await prisma.user.findUnique({
    where: {
      uniq_external_identity: { externalProvider: input.provider, externalSubject: input.userSubject },
    },
  });
  const userCreated = !user;
  if (!user && !opts.dryRun) {
    user = await prisma.user.create({
      data: {
        externalProvider: input.provider,
        externalSubject: input.userSubject,
        email: input.userEmail ?? null,
        displayName: input.userEmail ? input.userEmail.split('@')[0] : null,
        status: 'ACTIVE',
      },
    });
  }

  // Organização (por slug). Conflito material: slug existente com outro nome.
  let org = await prisma.organization.findUnique({ where: { slug: input.slug } });
  if (org && org.name !== input.name) {
    throw new Error(`Conflito material: slug "${input.slug}" já existe com outro nome ("${org.name}").`);
  }
  const orgCreated = !org;
  if (!org && !opts.dryRun) {
    org = await prisma.organization.create({
      data: { name: input.name, slug: input.slug, status: 'ACTIVE' },
    });
  }

  // Membership ativa.
  let membership =
    user && org
      ? await prisma.membership.findUnique({
          where: { uniq_membership: { userId: user.id, organizationId: org.id } },
        })
      : null;
  const membershipCreated = !membership;
  if (!membership && !opts.dryRun && user && org) {
    membership = await prisma.membership.create({
      data: { userId: user.id, organizationId: org.id, status: 'ACTIVE' },
    });
  }

  // Papel inicial + auditoria.
  let roleAssignment = false;
  if (!opts.dryRun && membership && role && user && org) {
    await prisma.membershipRole.upsert({
      where: { membershipId_roleId: { membershipId: membership.id, roleId: role.id } },
      create: { membershipId: membership.id, roleId: role.id },
      update: {},
    });
    roleAssignment = true;
    await prisma.identityAuditEvent.create({
      data: {
        actorUserId: user.id,
        organizationId: org.id,
        action: 'identity.bootstrap',
        resourceType: 'Organization',
        resourceId: org.id,
        outcome: 'SUCCESS',
        correlationId: `bootstrap-${new Date().toISOString()}`,
        metadata: { roleKey: input.roleKey, slug: input.slug },
      },
    });
  }

  return {
    dryRun: opts.dryRun,
    userId: user?.id ?? null,
    organizationId: org?.id ?? null,
    membershipId: membership?.id ?? null,
    created: { user: userCreated, organization: orgCreated, membership: membershipCreated, roleAssignment },
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = Boolean(args['dry-run']);
  const yes = Boolean(args.yes);

  const name = String(args.name ?? '');
  const slug = String(args.slug ?? '');
  const userSubject = String(args['user-subject'] ?? '');
  const userEmail = args['user-email'] ? String(args['user-email']) : null;
  const provider = String(args.provider ?? process.env.AUTH_PROVIDER ?? 'supabase');
  const roleKey = String(args.role ?? 'corporate_admin');

  if (!name || !slug || !userSubject) {
    // eslint-disable-next-line no-console
    console.error('Uso: --name <nome> --slug <slug> --user-subject <subject> [--user-email <email>] [--provider <p>] [--role <key>] [--dry-run] [--yes]');
    process.exit(2);
  }

  // eslint-disable-next-line no-console
  console.log(
    `Bootstrap ${dryRun ? '(DRY-RUN) ' : ''}→ organização "${name}" (${slug}), usuário provider=${provider} subject=${userSubject}, papel=${roleKey}`,
  );

  if (!dryRun && !yes) {
    const ok = await confirm('Confirmar bootstrap? (y/N) ');
    if (!ok) {
      // eslint-disable-next-line no-console
      console.error('Abortado (sem confirmação). Use --yes em ambiente não interativo.');
      process.exit(1);
    }
  }

  const prisma = new PrismaClient();
  try {
    const result = await bootstrapOrganization(prisma, { name, slug, userSubject, userEmail, provider, roleKey }, { dryRun });
    // eslint-disable-next-line no-console
    console.log('Resultado:', JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

// Executa como CLI apenas quando invocado pelo script `bootstrap:organization`
// (guarda explícita — vite-node/ESM não expõe require.main de forma confiável).
if (process.env.ARDEN_CLI === 'bootstrap') {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Falha no bootstrap:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
