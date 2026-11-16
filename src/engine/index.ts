// ============================================================================
// ENTRYPOINT MODULAR DO MOTOR CLÍNICO (Conectado via Vite / ES Modules)
// ============================================================================

import * as PersonalizarEngine from './personalizar';
import * as WorkstationEngine from './workstation';
import * as SearchEngine from './search';
import * as DiretrizesEngine from './diretrizes';

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
