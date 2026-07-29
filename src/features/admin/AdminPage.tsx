import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';

type Group = 'structure' | 'people' | 'operation' | 'control' | 'platform';

interface AdminArea {
  group: Group;
  title: string;
  state: string;
  description: string;
  to: string;
}

// Dezesseis áreas administrativas em cinco grupos (do mockup).
const AREAS: AdminArea[] = [
  { group: 'structure', title: 'Organizações e empresas', state: '4 entidades', description: 'Grupo, três empresas e nove unidades, com responsável e política herdada por nível.', to: '/admin' },
  { group: 'structure', title: 'Áreas e centros de custo', state: '9 centros', description: 'Centros de custo com orçamento, consumo e responsável, vinculados a operações.', to: '/work-units' },
  { group: 'structure', title: 'Ambientes e versionamento', state: '3 ambientes', description: 'Sandbox, staging e produção, com promoção sequencial e rollback.', to: '/environments' },

  { group: 'people', title: 'Pessoas e equipes', state: '9 pessoas', description: 'Convite, papéis, suspensão e reativação, com auditoria por alteração.', to: '/people' },
  { group: 'people', title: 'Papéis e permissões', state: '8 perfis', description: 'Matriz de permissões nomeadas por perfil, aplicada a rota, botão e campo.', to: '/people' },
  { group: 'people', title: 'Acessos e sessões', state: 'Revisão ativa', description: 'Sessões, dispositivos e revisão de acesso, com tentativas negadas.', to: '/security' },

  { group: 'operation', title: 'Operações', state: '9 ativas', description: 'Catálogo de operações, publicação pelo wizard e execução.', to: '/operations' },
  { group: 'operation', title: 'Implantação corporativa', state: '16 etapas', description: 'Trava sequencial de implantação com responsável e resultado por etapa.', to: '/deployment' },
  { group: 'operation', title: 'Gatilhos e agendamento', state: 'Por operação', description: 'Gatilhos, frequência e SLA definidos na configuração da operação.', to: '/operations' },

  { group: 'control', title: 'Governança e políticas', state: '8 políticas', description: 'Herança entre níveis, versionamento e retenção.', to: '/governance' },
  { group: 'control', title: 'Gradientes de Autoridade', state: '12 ações', description: 'Autoridade por ação e por operação, do observar ao bloqueado.', to: '/authority' },
  { group: 'control', title: 'Work Units e orçamento', state: '782 consumidas', description: 'Capacidade contratada, consumo, excedente e aprovação financeira.', to: '/work-units' },
  { group: 'control', title: 'Integrações', state: '2 conectadas', description: 'Conexões autorizadas, teste e logs.', to: '/integrations' },

  { group: 'platform', title: 'Contexto corporativo', state: '1 fonte', description: 'Fontes de contexto versionadas por organização.', to: '/context' },
  { group: 'platform', title: 'Auditoria', state: 'Contínua', description: 'Trilha com estado anterior e novo em cada evento.', to: '/audit' },
  { group: 'platform', title: 'Relatórios', state: 'Exportável', description: 'Relatórios autorizados com exportação registrada na auditoria.', to: '/reports' },
];

const GROUP_ORDER: Group[] = ['structure', 'people', 'operation', 'control', 'platform'];
const GROUP_KEY: Record<Group, string> = {
  structure: 'admin.groupStructure',
  people: 'admin.groupPeople',
  operation: 'admin.groupOperation',
  control: 'admin.groupControl',
  platform: 'admin.groupPlatform',
};

export function AdminPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader title={t('admin.title')} subtitle={t('admin.subtitle')} />
      <div className="stack">
        {GROUP_ORDER.map((group) => {
          const areas = AREAS.filter((a) => a.group === group);
          return (
            <section key={group}>
              <div className="t-micro" style={{ marginBottom: 'var(--sp-3)' }}>
                {t(GROUP_KEY[group])}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 'var(--sp-3)',
                }}
              >
                {areas.map((a) => (
                  <div key={a.title} className="card" style={{ padding: 'var(--sp-4)' }}>
                    <div className="card-head" style={{ marginBottom: 8 }}>
                      <strong>{a.title}</strong>
                      <span className="chip mono">{a.state}</span>
                    </div>
                    <p style={{ color: 'var(--tx2)', fontSize: '0.8125rem', marginBottom: 'var(--sp-3)' }}>
                      {a.description}
                    </p>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => navigate(a.to)}
                    >
                      {t('admin.open')}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
