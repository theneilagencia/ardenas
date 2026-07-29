import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { useScopedData } from '@/hooks/use-session';
import type { AssessmentStage } from '@/domain/types';

const STAGE_KEY: Record<AssessmentStage, string> = {
  analyzing: 'assessment.stageAnalyzing',
  awaiting_info: 'assessment.stageAwaiting_info',
  completed: 'assessment.stageCompleted',
};

const STAGE_COLOR: Record<AssessmentStage, string> = {
  analyzing: 'var(--st-working)',
  awaiting_info: 'var(--st-waiting)',
  completed: 'var(--st-completed)',
};

export function AssessmentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { assessments } = useScopedData();

  return (
    <>
      <PageHeader
        title={t('assessment.title')}
        subtitle={t('assessment.subtitle')}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => navigate('/evaluator')}>
            {t('assessment.evaluateNew')}
          </button>
        }
      />
      <div className="card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('assessment.colOperation')}</th>
                <th>{t('assessment.colCompany')}</th>
                <th>{t('assessment.colResponsible')}</th>
                <th>{t('assessment.colStage')}</th>
                <th>{t('assessment.colRecommendation')}</th>
                <th className="mono">{t('assessment.colExec')}</th>
                <th className="mono">{t('assessment.colWu')}</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.operationName}</strong>
                    <div className="t-micro" style={{ textTransform: 'none', letterSpacing: 0 }}>
                      {a.discipline} · {a.date}
                    </div>
                  </td>
                  <td>{a.company}</td>
                  <td>{a.responsibleName}</td>
                  <td>
                    <span className="badge">
                      <span
                        className="state-dot"
                        style={{ background: STAGE_COLOR[a.stage] }}
                        aria-hidden
                      />
                      {t(STAGE_KEY[a.stage])}
                    </span>
                  </td>
                  <td>{a.recommendation}</td>
                  <td className="mono">{a.execScore}</td>
                  <td className="mono">{a.workUnitsRange}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
