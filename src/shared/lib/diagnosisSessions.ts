import { demoDataAdapters, getActiveDemoDataAdapter } from '@/shared/lib/data';
import type { SaveDiagnosisSessionInput } from '@/shared/lib/data/contracts';

export async function persistDiagnosisSession(input: SaveDiagnosisSessionInput) {
  const adapter = getActiveDemoDataAdapter();
  const saved = await adapter.saveDiagnosisSession(input);

  if (saved || adapter.id === 'local') {
    return saved;
  }

  return demoDataAdapters.local.saveDiagnosisSession(input);
}
