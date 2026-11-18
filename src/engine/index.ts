// ============================================================================
// ENTRYPOINT MODULAR DO MOTOR CLÍNICO (Conectado via Vite / ES Modules)
// ============================================================================

import * as PersonalizarEngine from './personalizar.ts';
import * as WorkstationEngine from './workstation.ts';
import * as SearchEngine from './search.ts';
import * as DiretrizesEngine from './diretrizes.ts';
import * as CalculadorasEngine from './calculadoras.ts';
import * as Central6AnoEngine from './central6ano.ts';
import * as ClinicalLinks from '../data/clinical_links.ts';
import * as StoreState from '../state/store.ts';
import * as RouterState from '../state/router.ts';

export {
  PersonalizarEngine,
  WorkstationEngine,
  SearchEngine,
  DiretrizesEngine,
  CalculadorasEngine,
  Central6AnoEngine,
  ClinicalLinks,
  StoreState,
  RouterState
};

if (typeof window !== 'undefined') {
  (window as any).__ClinicoEngine = {
    ...PersonalizarEngine,
    ...WorkstationEngine,
    ...SearchEngine,
    ...DiretrizesEngine,
    ...CalculadorasEngine,
    ...Central6AnoEngine
  };
}
