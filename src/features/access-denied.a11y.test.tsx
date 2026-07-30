import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { AccessDenied } from '@/components/AccessDenied';
import { useAppStore } from '@/store/app-store';
import { setServices, setSnapshotStore } from '@/services/service-container';
import { MemorySnapshotStore } from '@/services/data/snapshot-store';
import { buildSeed } from '@/domain/seed';
import '@/i18n';

beforeEach(async () => {
  setSnapshotStore(new MemorySnapshotStore(buildSeed()));
  setServices(null);
  await useAppStore.getState().bootstrap();
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
