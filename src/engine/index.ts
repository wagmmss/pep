// ============================================================================
// ENTRYPOINT MODULAR DO MOTOR CLÍNICO (Conectado via Vite / ES Modules)
// ============================================================================

import * as PersonalizarEngine from './personalizar.ts';
import * as WorkstationEngine from './workstation.ts';
import * as SearchEngine from './search.ts';
import * as DiretrizesEngine from './diretrizes.ts';

export {
  PersonalizarEngine,
  WorkstationEngine,
  SearchEngine,
  DiretrizesEngine
};

if (typeof window !== 'undefined') {
  (window as any).__ClinicoEngine = {
    ...PersonalizarEngine,
    ...WorkstationEngine,
    ...SearchEngine,
    ...DiretrizesEngine
  };
}
