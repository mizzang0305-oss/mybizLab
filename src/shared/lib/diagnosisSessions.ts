import { demoDataAdapters, getActiveDemoDataAdapter } from './data/index.js';
import type { SaveDiagnosisSessionInput } from './data/contracts.js';

export async function persistDiagnosisSession(input: SaveDiagnosisSessionInput) {
  const adapter = getActiveDemoDataAdapter();
  const saved = await adapter.saveDiagnosisSession(input);

  if (saved || adapter.id === 'local') {
    return saved;
  }

  return demoDataAdapters.local.saveDiagnosisSession(input);
}
