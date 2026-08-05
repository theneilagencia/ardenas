import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { AccessDenied } from '@/components/AccessDenied';
import { useAppStore } from '@/store/app-store';
import { setServices, setSnapshotStore } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { buildSessionContext } from '@/services/session/session-derivation';
import { buildSeed } from '@/domain/seed';
import '@/i18n';

beforeEach(async () => {
  setSnapshotStore(new MemorySnapshotStore(buildSeed()));
  setServices(null);
  await useAppStore.getState().bootstrap();
  // Espelha uma sessão ativa (a autoridade real é o TenantContext).
  const session = buildSessionContext({
    snapshot: buildSeed(),
    currentUserId: null,
    activeOrganizationId: 'org_arden',
    expiresAt: null,
  });
  useAppStore.getState().applySession(session);
});

describe('acessibilidade — tela de acesso negado', () => {
  it('não tem violações de axe (regras críticas e sérias)', async () => {
    const { container } = render(
      <MemoryRouter>
        <AccessDenied permission="policy.publish" />
      </MemoryRouter>,
    );

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toHaveLength(0);
  });
});
