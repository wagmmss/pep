// ============================================================================
// REMUME (Ribeirão Preto) — Lista Padronizada de Medicamentos (252 itens)
// Mapeamento REMUME -> Guia HSL: 190/252 (75.4%) vinculados.
// Gerado por scripts/build_hsl_remume.py — manter compatibilidade com RemumeItem.
// ============================================================================

export type TherapeuticClass =
  | 'aine'
  | 'analgesico_nao_opioide'
  | 'opioide'
  | 'beta_lactamico_penicilina'
  | 'beta_lactamico_cefalosporina'
  | 'macrolideo'
  | 'fluoroquinolona'
  | 'tetraciclina'
  | 'aminoglicosideo'
  | 'sulfonamida'
  | 'nitrofurano'
  | 'nitroimidazol'
  | 'lincosamida'
  | 'corticoide'
  | 'ibp'
  | 'antiemetico'
  | 'benzodiazepinico'
  | 'anticonvulsivante'
  | 'ieca'
  | 'bra'
  | 'betabloqueador'
  | 'bcc'
  | 'diuretico'
  | 'biguanida'
  | 'sulfonilureia'
  | 'anticoagulante'
  | 'antiplaquetario'
  | 'estatina'
  | 'anti_histaminico'
  | 'broncodilatador'
  | 'antiviral'
  | 'antifungico'
  | 'antiparasitario'
  | 'antigotoso'
  | 'antiarritmico'
  | 'teratogenico_especial'
  | 'outro';

export type PregnancyRiskCategory = 'A' | 'B' | 'C' | 'D' | 'X' | 'EVITAR_3TRI';

export interface RenalAdjustmentRule {
  required: boolean;
  /** TFG/ClCr (mL/min) abaixo do qual exige ajuste de dose ou intervalo */
  gfrCutoffMlMin?: number;
  /** TFG/ClCr (mL/min) abaixo do qual é contraindicado / evitar */
  contraindicatedBelowGfr?: number;
  note?: string;
}

export interface RemumeClinicalMeta {
  canonicalKey: string;
  therapeuticClass: TherapeuticClass;
  classLabel: string;
  /** Grupo amplo para auditoria de duplicidade (ex.: beta_lactamico agrupa penicilina + cefalosporina) */
  duplicityGroup: string;
  renalAdjustment: RenalAdjustmentRule;
  pregnancyRisk: PregnancyRiskCategory;
  pregnancyNote?: string;
  /** Grupos de alergia direta e cruzada (normalizados sem acento) */
  allergyCrossGroups: string[];
  /** Grupos com risco moderado de reação cruzada (disparam alerta warn) */
  allergyWarnGroups?: string[];
  /** Teto diário adulto em mg */
  maxDailyDoseMg?: number;
  /** Teto diário pediátrico em mg/kg/dia */
  maxDailyDoseMgPerKg?: number;
  /** Teto por tomada única adulto em mg */
  maxSingleDoseMg?: number;
  notes?: string;
}

export interface RemumeItem {
  name: string;
  norm: string;
  hslId?: number;
  hslFarmaco?: string;
  clinicalMeta?: RemumeClinicalMeta;
}

export const REMUME_ITEMS: RemumeItem[] = [
  {
    "name": "Abacavir 300 mg",
    "norm": "abacavir 300 mg"
  },
  {
    "name": "Aciclovir 200 mg",
    "norm": "aciclovir 200 mg",
    "hslId": 8,
    "hslFarmaco": "ACICLOVIR"
  },
  {
    "name": "Adenosina 3 mg/mL ap. 2 mL",
    "norm": "adenosina 3 mg/ml ap. 2 ml",
    "hslId": 21,
    "hslFarmaco": "ADENOSINA"
  },
  {
    "name": "Adrenalina 1 mg/mL ap. 1 mL",
    "norm": "adrenalina 1 mg/ml ap. 1 ml",
    "hslId": 162,
    "hslFarmaco": "EPINEFRINA"
  },
  {
    "name": "Albendazol 400 mg",
    "norm": "albendazol 400 mg",
    "hslId": 23,
    "hslFarmaco": "ALBENDAZOL"
  },
  {
    "name": "Alendronato 70 mg",
    "norm": "alendronato 70 mg"
  },
  {
    "name": "Algestona, acetofenida 150 mg/mL",
    "norm": "algestona, acetofenida 150 mg/ml"
  },
  {
    "name": "Alopurinol 300 mg",
    "norm": "alopurinol 300 mg",
    "hslId": 36,
    "hslFarmaco": "ALOPURINOL"
  },
  {
    "name": "Amicacina 250 mg/mL ap. 2 mL",
    "norm": "amicacina 250 mg/ml ap. 2 ml",
    "hslId": 43,
    "hslFarmaco": "AMICACINA"
  },
  {
    "name": "Amiodarona 200 mg",
    "norm": "amiodarona 200 mg",
    "hslId": 46,
    "hslFarmaco": "AMIODARONA (Oral)"
  },
  {
    "name": "Amiodarona 50 mg/mL ap. 3 mL",
    "norm": "amiodarona 50 mg/ml ap. 3 ml",
    "hslId": 46,
    "hslFarmaco": "AMIODARONA (Oral)"
  },
  {
    "name": "Amitriptilina 25 mg",
    "norm": "amitriptilina 25 mg",
    "hslId": 47,
    "hslFarmaco": "AMITRIPTILINA"
  },
  {
    "name": "Amoxicilina 250 mg/5 mL",
    "norm": "amoxicilina 250 mg/5 ml",
    "hslId": 49,
    "hslFarmaco": "AMOXICILINA (A) + CLAVULANATO DE POTÁSSIO (B)"
  },
  {
    "name": "Amoxicilina 500 mg",
    "norm": "amoxicilina 500 mg",
    "hslId": 49,
    "hslFarmaco": "AMOXICILINA (A) + CLAVULANATO DE POTÁSSIO (B)"
  },
  {
    "name": "Amoxicilina+clavulanato de potássio (1000 mg+ 200 mg) fr. ap.",
    "norm": "amoxicilina+clavulanato de potassio (1000 mg+ 200 mg) fr. ap.",
    "hslId": 49,
    "hslFarmaco": "AMOXICILINA (A) + CLAVULANATO DE POTÁSSIO (B)"
  },
  {
    "name": "Amoxicilina+clavulanato de potássio (250 mg+ 62,5 mg)/5 mL",
    "norm": "amoxicilina+clavulanato de potassio (250 mg+ 62,5 mg)/5 ml",
    "hslId": 49,
    "hslFarmaco": "AMOXICILINA (A) + CLAVULANATO DE POTÁSSIO (B)"
  },
  {
    "name": "Amoxicilina+clavulanato de potássio 500+125 mg",
    "norm": "amoxicilina+clavulanato de potassio 500+125 mg",
    "hslId": 49,
    "hslFarmaco": "AMOXICILINA (A) + CLAVULANATO DE POTÁSSIO (B)"
  },
  {
    "name": "Anlodipino 5 mg",
    "norm": "anlodipino 5 mg",
    "hslId": 54,
    "hslFarmaco": "ANLODIPINO"
  },
  {
    "name": "Atazanavir 300 mg",
    "norm": "atazanavir 300 mg"
  },
  {
    "name": "Atenolol 50 mg",
    "norm": "atenolol 50 mg",
    "hslId": 57,
    "hslFarmaco": "ATENOLOL + CLORTALIDONA"
  },
  {
    "name": "Atropina 0,25 mg/mL ap. 1 mL",
    "norm": "atropina 0,25 mg/ml ap. 1 ml",
    "hslId": 62,
    "hslFarmaco": "ATROPINA"
  },
  {
    "name": "Azitromicina 200 mg/5 mL fr.",
    "norm": "azitromicina 200 mg/5 ml fr.",
    "hslId": 66,
    "hslFarmaco": "AZITROMICINA"
  },
  {
    "name": "Azitromicina 500 mg",
    "norm": "azitromicina 500 mg",
    "hslId": 66,
    "hslFarmaco": "AZITROMICINA"
  },
  {
    "name": "Baclofeno 10 mg",
    "norm": "baclofeno 10 mg",
    "hslId": 70,
    "hslFarmaco": "BACLOFENO"
  },
  {
    "name": "Beclometasona 200 mcg",
    "norm": "beclometasona 200 mcg",
    "hslId": 76,
    "hslFarmaco": "BECLOMETASONA dipropionato"
  },
  {
    "name": "Beclometasona 50 mcg",
    "norm": "beclometasona 50 mcg",
    "hslId": 76,
    "hslFarmaco": "BECLOMETASONA dipropionato"
  },
  {
    "name": "Benznidazol 12,5 mg ou 100 mg",
    "norm": "benznidazol 12,5 mg ou 100 mg"
  },
  {
    "name": "Benzocaína 200 mg/mL pt. 12 g",
    "norm": "benzocaina 200 mg/ml pt. 12 g",
    "hslId": 81,
    "hslFarmaco": "BENZOCAÍNA (A) + TRICLOSANA (B) + MENTOL(C)"
  },
  {
    "name": "Betametasona acetato 3mg/mL",
    "norm": "betametasona acetato 3mg/ml",
    "hslId": 87,
    "hslFarmaco": "BETAMETASONA, acetato (A) + BETAMETASONA, fosfato dissódico (B)"
  },
  {
    "name": "Biperideno 2 mg",
    "norm": "biperideno 2 mg",
    "hslId": 106,
    "hslFarmaco": "BIPERIDENO"
  },
  {
    "name": "Biperideno 5 mg/mL ap 1 mL",
    "norm": "biperideno 5 mg/ml ap 1 ml",
    "hslId": 106,
    "hslFarmaco": "BIPERIDENO"
  },
  {
    "name": "Bisacodil 5 mg",
    "norm": "bisacodil 5 mg",
    "hslId": 108,
    "hslFarmaco": "BISACODIL"
  },
  {
    "name": "Bromoprida 4 mg/mL fr.",
    "norm": "bromoprida 4 mg/ml fr.",
    "hslId": 112,
    "hslFarmaco": "BROMOPRIDA"
  },
  {
    "name": "Bromoprida 5 mg/mL ap 2 mL",
    "norm": "bromoprida 5 mg/ml ap 2 ml",
    "hslId": 112,
    "hslFarmaco": "BROMOPRIDA"
  },
  {
    "name": "Bupropiona 150 mg",
    "norm": "bupropiona 150 mg",
    "hslId": 393,
    "hslFarmaco": "BUPROPIONA"
  },
  {
    "name": "Cabergolina 0,5 mg",
    "norm": "cabergolina 0,5 mg"
  },
  {
    "name": "Captopril 25 mg",
    "norm": "captopril 25 mg",
    "hslId": 399,
    "hslFarmaco": "CAPTOPRIL"
  },
  {
    "name": "Carbamazepina 200 mg",
    "norm": "carbamazepina 200 mg",
    "hslId": 401,
    "hslFarmaco": "CARBAMAZEPINA"
  },
  {
    "name": "Carbonato de Lítio 300 mg",
    "norm": "carbonato de litio 300 mg",
    "hslId": 829,
    "hslFarmaco": "CARBONATO DE LÍTIO"
  },
  {
    "name": "Carbonato de cálcio 500 mg",
    "norm": "carbonato de calcio 500 mg",
    "hslId": 394,
    "hslFarmaco": "Carbonato de CÁLCIO"
  },
  {
    "name": "Carvedilol 12,5 mg",
    "norm": "carvedilol 12,5 mg",
    "hslId": 406,
    "hslFarmaco": "CARVEDILOL"
  },
  {
    "name": "Carvedilol 6,25 mg",
    "norm": "carvedilol 6,25 mg",
    "hslId": 406,
    "hslFarmaco": "CARVEDILOL"
  },
  {
    "name": "Carvão ativado 10 g e 30 g",
    "norm": "carvao ativado 10 g e 30 g",
    "hslId": 405,
    "hslFarmaco": "CARVÃO VEGETAL ATIVADO"
  },
  {
    "name": "Cefalexina 250 mg/5 mL",
    "norm": "cefalexina 250 mg/5 ml",
    "hslId": 411,
    "hslFarmaco": "CEFALEXINA"
  },
  {
    "name": "Cefalexina 500 mg",
    "norm": "cefalexina 500 mg",
    "hslId": 411,
    "hslFarmaco": "CEFALEXINA"
  },
  {
    "name": "Ceftriaxona 1 g fr.ap.",
    "norm": "ceftriaxona 1 g fr.ap.",
    "hslId": 418,
    "hslFarmaco": "CEFTRIAXONA"
  },
  {
    "name": "Cefuroxima 250 mg",
    "norm": "cefuroxima 250 mg",
    "hslId": 419,
    "hslFarmaco": "CEFUROXIMA"
  },
  {
    "name": "Cetoprofeno 100 mg fr. ou bolsa",
    "norm": "cetoprofeno 100 mg fr. ou bolsa",
    "hslId": 426,
    "hslFarmaco": "CETOPROFENO"
  },
  {
    "name": "Ciprofloxacina 500 mg",
    "norm": "ciprofloxacina 500 mg",
    "hslId": 475,
    "hslFarmaco": "CIPROFLOXACINO"
  },
  {
    "name": "Ciproterona, acetato 50 mg",
    "norm": "ciproterona, acetato 50 mg",
    "hslId": 483,
    "hslFarmaco": "CIPROTERONA"
  },
  {
    "name": "Claritromicina 500 mg",
    "norm": "claritromicina 500 mg",
    "hslId": 488,
    "hslFarmaco": "CLARITROMICINA"
  },
  {
    "name": "Clindamicina 150 mg/mL ap.",
    "norm": "clindamicina 150 mg/ml ap.",
    "hslId": 517,
    "hslFarmaco": "CLINDAMICINA"
  },
  {
    "name": "Clindamicina 300 mg",
    "norm": "clindamicina 300 mg",
    "hslId": 517,
    "hslFarmaco": "CLINDAMICINA"
  },
  {
    "name": "Clomipramina 25 mg",
    "norm": "clomipramina 25 mg",
    "hslId": 522,
    "hslFarmaco": "CLOMIPRAMINA"
  },
  {
    "name": "Clonazepam 2 mg",
    "norm": "clonazepam 2 mg",
    "hslId": 523,
    "hslFarmaco": "CLONAZEPAM"
  },
  {
    "name": "Clonazepam 2,5 mg/ml fr.",
    "norm": "clonazepam 2,5 mg/ml fr.",
    "hslId": 523,
    "hslFarmaco": "CLONAZEPAM"
  },
  {
    "name": "Clonidina 0,15 mg",
    "norm": "clonidina 0,15 mg",
    "hslId": 524,
    "hslFarmaco": "CLONIDINA"
  },
  {
    "name": "Clopidogrel 75 mg",
    "norm": "clopidogrel 75 mg",
    "hslId": 525,
    "hslFarmaco": "CLOPIDOGREL"
  },
  {
    "name": "Cloroquina difosfato 250 mg",
    "norm": "cloroquina difosfato 250 mg"
  },
  {
    "name": "Clorpromazina 100 mg",
    "norm": "clorpromazina 100 mg",
    "hslId": 566,
    "hslFarmaco": "CLORPROMAZINA"
  },
  {
    "name": "Clorpromazina 25 mg",
    "norm": "clorpromazina 25 mg",
    "hslId": 566,
    "hslFarmaco": "CLORPROMAZINA"
  },
  {
    "name": "Clorpromazina 5 mg/mL ap.",
    "norm": "clorpromazina 5 mg/ml ap.",
    "hslId": 566,
    "hslFarmaco": "CLORPROMAZINA"
  },
  {
    "name": "Daclatasvir 60 mg",
    "norm": "daclatasvir 60 mg"
  },
  {
    "name": "Dapsona 100 mg",
    "norm": "dapsona 100 mg"
  },
  {
    "name": "Darunavir 600 mg",
    "norm": "darunavir 600 mg"
  },
  {
    "name": "Darunavir 800 mg",
    "norm": "darunavir 800 mg"
  },
  {
    "name": "Deslanosídeo 0,2 mg/mL ap.",
    "norm": "deslanosideo 0,2 mg/ml ap.",
    "hslId": 129,
    "hslFarmaco": "DESLANOSIDEO"
  },
  {
    "name": "Dexametasona 4 mg/mL ap.",
    "norm": "dexametasona 4 mg/ml ap.",
    "hslId": 132,
    "hslFarmaco": "DEXAMETASONA (Colírio)"
  },
  {
    "name": "Dexclorfeniramina 2 mg",
    "norm": "dexclorfeniramina 2 mg",
    "hslId": 136,
    "hslFarmaco": "DEXCLORFENIRAMINA"
  },
  {
    "name": "Dexclorfeniramina 2 mg/5 mL",
    "norm": "dexclorfeniramina 2 mg/5 ml",
    "hslId": 136,
    "hslFarmaco": "DEXCLORFENIRAMINA"
  },
  {
    "name": "Dextrocetamina 50 mg/mL",
    "norm": "dextrocetamina 50 mg/ml",
    "hslId": 421,
    "hslFarmaco": "ESCETAMINA"
  },
  {
    "name": "Diazepam 10 mg",
    "norm": "diazepam 10 mg",
    "hslId": 142,
    "hslFarmaco": "DIAZEPAM"
  },
  {
    "name": "Diazepam 5 mg",
    "norm": "diazepam 5 mg",
    "hslId": 142,
    "hslFarmaco": "DIAZEPAM"
  },
  {
    "name": "Diazepam 5 mg/mL ap. 2 mL",
    "norm": "diazepam 5 mg/ml ap. 2 ml",
    "hslId": 142,
    "hslFarmaco": "DIAZEPAM"
  },
  {
    "name": "Diclofenaco Sódico 25 mg/mL",
    "norm": "diclofenaco sodico 25 mg/ml",
    "hslId": 146,
    "hslFarmaco": "DICLOFENACO SÓDICO"
  },
  {
    "name": "Digoxina 0,25 mg",
    "norm": "digoxina 0,25 mg",
    "hslId": 148,
    "hslFarmaco": "DIGOXINA"
  },
  {
    "name": "Dimeticona 75 mg/mL",
    "norm": "dimeticona 75 mg/ml",
    "hslId": 636,
    "hslFarmaco": "SIMETICONA"
  },
  {
    "name": "Dinitrato de isossorbida 5 mg",
    "norm": "dinitrato de isossorbida 5 mg",
    "hslId": 307,
    "hslFarmaco": "ISOSSORBIDA, dinitrato"
  },
  {
    "name": "Dipirona 500 mg",
    "norm": "dipirona 500 mg",
    "hslId": 707,
    "hslFarmaco": "DIPIRONA (A) + CAFEÍNA (B) + ORFENADINA (C)"
  },
  {
    "name": "Dipirona 500 mg/mL",
    "norm": "dipirona 500 mg/ml",
    "hslId": 707,
    "hslFarmaco": "DIPIRONA (A) + CAFEÍNA (B) + ORFENADINA (C)"
  },
  {
    "name": "Dipirona 500 mg/mL ap. 2 mL",
    "norm": "dipirona 500 mg/ml ap. 2 ml",
    "hslId": 707,
    "hslFarmaco": "DIPIRONA (A) + CAFEÍNA (B) + ORFENADINA (C)"
  },
  {
    "name": "Dobutamina 12,5 mg/mL ap.",
    "norm": "dobutamina 12,5 mg/ml ap.",
    "hslId": 710,
    "hslFarmaco": "DOBUTAMINA"
  },
  {
    "name": "Dolutegravir + lamivudina 50 mg + 300 mg",
    "norm": "dolutegravir + lamivudina 50 mg + 300 mg"
  },
  {
    "name": "Dolutegravir 50 mg",
    "norm": "dolutegravir 50 mg"
  },
  {
    "name": "Domperidona 1 mg/mL fr.",
    "norm": "domperidona 1 mg/ml fr.",
    "hslId": 712,
    "hslFarmaco": "DOMPERIDONA"
  },
  {
    "name": "Dopamina 5 mg/mL ap. 10 mL",
    "norm": "dopamina 5 mg/ml ap. 10 ml",
    "hslId": 714,
    "hslFarmaco": "DOPAMINA"
  },
  {
    "name": "Doxazosina 2 mg",
    "norm": "doxazosina 2 mg"
  },
  {
    "name": "Doxiciclina 100 mg",
    "norm": "doxiciclina 100 mg",
    "hslId": 716,
    "hslFarmaco": "DOXICICLINA"
  },
  {
    "name": "Efavirenz 600 mg",
    "norm": "efavirenz 600 mg"
  },
  {
    "name": "Enalapril 20 mg",
    "norm": "enalapril 20 mg",
    "hslId": 144,
    "hslFarmaco": "ENALAPRIL"
  },
  {
    "name": "Entecavir 0,5 mg",
    "norm": "entecavir 0,5 mg"
  },
  {
    "name": "Espiramicina 1.500.000 UI",
    "norm": "espiramicina 1.500.000 ui"
  },
  {
    "name": "Espironolactona 100 mg",
    "norm": "espironolactona 100 mg",
    "hslId": 177,
    "hslFarmaco": "ESPIRONOLACTONA"
  },
  {
    "name": "Espironolactona 25 mg",
    "norm": "espironolactona 25 mg",
    "hslId": 177,
    "hslFarmaco": "ESPIRONOLACTONA"
  },
  {
    "name": "Estradiol 1 mg",
    "norm": "estradiol 1 mg"
  },
  {
    "name": "Estradiol 2 mg",
    "norm": "estradiol 2 mg"
  },
  {
    "name": "Estriol 1 mg/g creme vaginal",
    "norm": "estriol 1 mg/g creme vaginal"
  },
  {
    "name": "Etambutol 400 mg",
    "norm": "etambutol 400 mg"
  },
  {
    "name": "Etomidato 2 mg/mL ap.",
    "norm": "etomidato 2 mg/ml ap.",
    "hslId": 180,
    "hslFarmaco": "ETOMIDATO"
  },
  {
    "name": "Etonogestrel 68 mg",
    "norm": "etonogestrel 68 mg",
    "hslId": 933,
    "hslFarmaco": "Etonogestrel"
  },
  {
    "name": "Etravirina 200 mg",
    "norm": "etravirina 200 mg"
  },
  {
    "name": "Fenitoína 100 mg",
    "norm": "fenitoina 100 mg",
    "hslId": 190,
    "hslFarmaco": "FENITOINA"
  },
  {
    "name": "Fenitoína 50 mg/mL ap. 5 mL",
    "norm": "fenitoina 50 mg/ml ap. 5 ml",
    "hslId": 190,
    "hslFarmaco": "FENITOINA"
  },
  {
    "name": "Fenobarbital 100 mg",
    "norm": "fenobarbital 100 mg",
    "hslId": 191,
    "hslFarmaco": "FENOBARBITAL"
  },
  {
    "name": "Fenobarbital 200 mg/mL ap.",
    "norm": "fenobarbital 200 mg/ml ap.",
    "hslId": 191,
    "hslFarmaco": "FENOBARBITAL"
  },
  {
    "name": "Fentanila 50 mcg/mL ap.",
    "norm": "fentanila 50 mcg/ml ap.",
    "hslId": 691,
    "hslFarmaco": "FENTANILA (TRANSDÉRMICO)"
  },
  {
    "name": "Finasterida 5 mg",
    "norm": "finasterida 5 mg"
  },
  {
    "name": "Fluconazol 150 mg",
    "norm": "fluconazol 150 mg",
    "hslId": 205,
    "hslFarmaco": "FLUCONAZOL"
  },
  {
    "name": "Flumazenil 0,1 mg/mL ap. 5 mL",
    "norm": "flumazenil 0,1 mg/ml ap. 5 ml",
    "hslId": 209,
    "hslFarmaco": "FLUMAZENIL"
  },
  {
    "name": "Fluoxetina 20 mg",
    "norm": "fluoxetina 20 mg",
    "hslId": 215,
    "hslFarmaco": "FLUOXETINA"
  },
  {
    "name": "Furosemida 10 mg/mL ap. 2 mL",
    "norm": "furosemida 10 mg/ml ap. 2 ml",
    "hslId": 232,
    "hslFarmaco": "FUROSEMIDA"
  },
  {
    "name": "Furosemida 40 mg",
    "norm": "furosemida 40 mg",
    "hslId": 232,
    "hslFarmaco": "FUROSEMIDA"
  },
  {
    "name": "Gabapentina 300 mg",
    "norm": "gabapentina 300 mg",
    "hslId": 234,
    "hslFarmaco": "GABAPENTINA"
  },
  {
    "name": "Gentamicina 80 mg/2 mL",
    "norm": "gentamicina 80 mg/2 ml",
    "hslId": 250,
    "hslFarmaco": "GENTAMICINA"
  },
  {
    "name": "Glibenclamida 5 mg",
    "norm": "glibenclamida 5 mg",
    "hslId": 251,
    "hslFarmaco": "GLIBENCLAMIDA"
  },
  {
    "name": "Glicerina 12% fr. 500 mL",
    "norm": "glicerina 12% fr. 500 ml",
    "hslId": 252,
    "hslFarmaco": "GLICERINA"
  },
  {
    "name": "Gliclazida 30 mg MR",
    "norm": "gliclazida 30 mg mr",
    "hslId": 254,
    "hslFarmaco": "GLICLAZIDA MR"
  },
  {
    "name": "Gliclazida 60 mg MR fracionável",
    "norm": "gliclazida 60 mg mr fracionavel",
    "hslId": 254,
    "hslFarmaco": "GLICLAZIDA MR"
  },
  {
    "name": "Glicose 5% fr. 500 mL",
    "norm": "glicose 5% fr. 500 ml",
    "hslId": 674,
    "hslFarmaco": "GLICOSE"
  },
  {
    "name": "Glicose 50% ap. 10 mL",
    "norm": "glicose 50% ap. 10 ml",
    "hslId": 674,
    "hslFarmaco": "GLICOSE"
  },
  {
    "name": "Gluconato de cálcio 100 mg/mL",
    "norm": "gluconato de calcio 100 mg/ml",
    "hslId": 258,
    "hslFarmaco": "GLUCONATO DE CÁLCIO"
  },
  {
    "name": "Haloperidol 1 mg",
    "norm": "haloperidol 1 mg",
    "hslId": 262,
    "hslFarmaco": "HALOPERIDOL"
  },
  {
    "name": "Haloperidol 5 mg",
    "norm": "haloperidol 5 mg",
    "hslId": 262,
    "hslFarmaco": "HALOPERIDOL"
  },
  {
    "name": "Haloperidol 5 mg/mL ap. 1 mL",
    "norm": "haloperidol 5 mg/ml ap. 1 ml",
    "hslId": 262,
    "hslFarmaco": "HALOPERIDOL"
  },
  {
    "name": "Heparina sódica 5.000 UI ap.",
    "norm": "heparina sodica 5.000 ui ap.",
    "hslId": 675,
    "hslFarmaco": "HEPARINA"
  },
  {
    "name": "Hidralazina cloridrato 20 mg ap.",
    "norm": "hidralazina cloridrato 20 mg ap.",
    "hslId": 884,
    "hslFarmaco": "HIDRALAZINA"
  },
  {
    "name": "Hidroclorotiazida 25 mg",
    "norm": "hidroclorotiazida 25 mg",
    "hslId": 270,
    "hslFarmaco": "HIDROCLOROTIAZIDA + LOSARTANA"
  },
  {
    "name": "Hidrocortisona 100 mg fr.",
    "norm": "hidrocortisona 100 mg fr.",
    "hslId": 271,
    "hslFarmaco": "HIDROCORTISONA"
  },
  {
    "name": "Hidrocortisona 500 mg fr.",
    "norm": "hidrocortisona 500 mg fr.",
    "hslId": 271,
    "hslFarmaco": "HIDROCORTISONA"
  },
  {
    "name": "Hioscina + dipirona 4 mg + 500 mg",
    "norm": "hioscina + dipirona 4 mg + 500 mg",
    "hslId": 174,
    "hslFarmaco": "ESCOPOLAMINA (A) + DIPIRONA SÓDICA (B)"
  },
  {
    "name": "Hioscina 20 mg ap. 1 mL",
    "norm": "hioscina 20 mg ap. 1 ml",
    "hslId": 173,
    "hslFarmaco": "ESCOPOLAMINA"
  },
  {
    "name": "Hipoclorito de sódio 25 mg/mL",
    "norm": "hipoclorito de sodio 25 mg/ml"
  },
  {
    "name": "Imipramina 25 mg",
    "norm": "imipramina 25 mg",
    "hslId": 284,
    "hslFarmaco": "IMIPRAMINA (não padrão)"
  },
  {
    "name": "Imiquimode 50 mg/g tb.",
    "norm": "imiquimode 50 mg/g tb."
  },
  {
    "name": "Insulina humana NPH 100 UI/mL",
    "norm": "insulina humana nph 100 ui/ml",
    "hslId": 678,
    "hslFarmaco": "INSULINA HUMANA RECOMBINANTE (NPH)"
  },
  {
    "name": "Isoniazida + rifampicina 150 mg + 300 mg",
    "norm": "isoniazida + rifampicina 150 mg + 300 mg"
  },
  {
    "name": "Isoniazida + rifampicina 75 mg + 150 mg",
    "norm": "isoniazida + rifampicina 75 mg + 150 mg"
  },
  {
    "name": "Isoniazida 100 mg",
    "norm": "isoniazida 100 mg"
  },
  {
    "name": "Isoniazida 300 mg",
    "norm": "isoniazida 300 mg"
  },
  {
    "name": "Itraconazol 100 mg",
    "norm": "itraconazol 100 mg",
    "hslId": 309,
    "hslFarmaco": "ITRACONAZOL"
  },
  {
    "name": "Ivermectina 6 mg",
    "norm": "ivermectina 6 mg",
    "hslId": 310,
    "hslFarmaco": "IVERMECTINA"
  },
  {
    "name": "Lamivudina 10 mg/ml fr.",
    "norm": "lamivudina 10 mg/ml fr.",
    "hslId": 315,
    "hslFarmaco": "LAMIVUDINA (A) + ZIDOVUDINA (B)"
  },
  {
    "name": "Lamivudina 150 mg",
    "norm": "lamivudina 150 mg",
    "hslId": 315,
    "hslFarmaco": "LAMIVUDINA (A) + ZIDOVUDINA (B)"
  },
  {
    "name": "Ledipasvir + sofosbuvir 90 mg + 400 mg",
    "norm": "ledipasvir + sofosbuvir 90 mg + 400 mg"
  },
  {
    "name": "Levomepromazina 25 mg",
    "norm": "levomepromazina 25 mg",
    "hslId": 322,
    "hslFarmaco": "LEVOMEPROMAZINA"
  },
  {
    "name": "Levonorgestrel 0,75 mg",
    "norm": "levonorgestrel 0,75 mg",
    "hslId": 323,
    "hslFarmaco": "LEVONORGESTREL"
  },
  {
    "name": "Levotiroxina 100 mcg",
    "norm": "levotiroxina 100 mcg",
    "hslId": 697,
    "hslFarmaco": "LEVOTIROXINA"
  },
  {
    "name": "Levotiroxina 25 mcg",
    "norm": "levotiroxina 25 mcg",
    "hslId": 697,
    "hslFarmaco": "LEVOTIROXINA"
  },
  {
    "name": "Levotiroxina 50 mcg",
    "norm": "levotiroxina 50 mcg",
    "hslId": 697,
    "hslFarmaco": "LEVOTIROXINA"
  },
  {
    "name": "Lidocaína + epinefrina 20mg/mL",
    "norm": "lidocaina + epinefrina 20mg/ml",
    "hslId": 327,
    "hslFarmaco": "LIDOCAÍNA (A) + EPINEFRINA (B)"
  },
  {
    "name": "Lopinavir + ritonavir (80 mg + 20 mg)/mL",
    "norm": "lopinavir + ritonavir (80 mg + 20 mg)/ml",
    "hslId": 337,
    "hslFarmaco": "LOPINAVIR (A) + RITONAVIR (B)"
  },
  {
    "name": "Loratadina 1 mg/mL",
    "norm": "loratadina 1 mg/ml",
    "hslId": 338,
    "hslFarmaco": "LORATADINA"
  },
  {
    "name": "Loratadina 10 mg",
    "norm": "loratadina 10 mg",
    "hslId": 338,
    "hslFarmaco": "LORATADINA"
  },
  {
    "name": "Losartana 50 mg",
    "norm": "losartana 50 mg",
    "hslId": 341,
    "hslFarmaco": "LOSARTANA"
  },
  {
    "name": "Manitol 20% fr. 250 mL",
    "norm": "manitol 20% fr. 250 ml",
    "hslId": 347,
    "hslFarmaco": "MANITOL"
  },
  {
    "name": "Maraviroque 150 mg",
    "norm": "maraviroque 150 mg"
  },
  {
    "name": "Mepivacaína 30 mg/mL tubete",
    "norm": "mepivacaina 30 mg/ml tubete"
  },
  {
    "name": "Metformina 850 mg",
    "norm": "metformina 850 mg",
    "hslId": 367,
    "hslFarmaco": "METFORMINA"
  },
  {
    "name": "Metildopa 250 ou 500 mg",
    "norm": "metildopa 250 ou 500 mg"
  },
  {
    "name": "Metilergometrina 0,2 mg/mL",
    "norm": "metilergometrina 0,2 mg/ml",
    "hslId": 368,
    "hslFarmaco": "METILERGOMETRINA"
  },
  {
    "name": "Metoclopramida 10 mg",
    "norm": "metoclopramida 10 mg",
    "hslId": 373,
    "hslFarmaco": "METOCLOPRAMIDA"
  },
  {
    "name": "Metoclopramida 5 mg/mL",
    "norm": "metoclopramida 5 mg/ml",
    "hslId": 373,
    "hslFarmaco": "METOCLOPRAMIDA"
  },
  {
    "name": "Metoprolol 1 mg/ml ap. 5 mL",
    "norm": "metoprolol 1 mg/ml ap. 5 ml",
    "hslId": 374,
    "hslFarmaco": "METOPROLOL, tartarato"
  },
  {
    "name": "Metoprolol succinato 25 mg",
    "norm": "metoprolol succinato 25 mg",
    "hslId": 723,
    "hslFarmaco": "METOPROLOL, succinato"
  },
  {
    "name": "Metoprolol succinato 50 mg",
    "norm": "metoprolol succinato 50 mg",
    "hslId": 723,
    "hslFarmaco": "METOPROLOL, succinato"
  },
  {
    "name": "Metronidazol 250 mg",
    "norm": "metronidazol 250 mg",
    "hslId": 375,
    "hslFarmaco": "METRONIDAZOL"
  },
  {
    "name": "Midazolam 5 mg/mL ap. 3 mL ou 10 mL",
    "norm": "midazolam 5 mg/ml ap. 3 ml ou 10 ml",
    "hslId": 701,
    "hslFarmaco": "MIDAZOLAM (INJETÁVEL)"
  },
  {
    "name": "Miltefosina 50 mg",
    "norm": "miltefosina 50 mg"
  },
  {
    "name": "Minociclina 100 mg",
    "norm": "minociclina 100 mg"
  },
  {
    "name": "Morfina 10 mg/mL ap. 1 mL",
    "norm": "morfina 10 mg/ml ap. 1 ml",
    "hslId": 434,
    "hslFarmaco": "MORFINA INJETAVEL"
  },
  {
    "name": "Naloxona 0,4 mg/mL ap. 1 mL",
    "norm": "naloxona 0,4 mg/ml ap. 1 ml",
    "hslId": 449,
    "hslFarmaco": "NALOXONA"
  },
  {
    "name": "Naltrexona 50 mg",
    "norm": "naltrexona 50 mg"
  },
  {
    "name": "Neomicina 5 mg/g + bacitracina 250 UI/g",
    "norm": "neomicina 5 mg/g + bacitracina 250 ui/g",
    "hslId": 453,
    "hslFarmaco": "NEOMICINA"
  },
  {
    "name": "Nevirapina 200 mg",
    "norm": "nevirapina 200 mg"
  },
  {
    "name": "Nevirapina 50 mg/5 mL",
    "norm": "nevirapina 50 mg/5 ml"
  },
  {
    "name": "Nicotina 14 mg",
    "norm": "nicotina 14 mg",
    "hslId": 458,
    "hslFarmaco": "NICOTINA"
  },
  {
    "name": "Nicotina 2 mg",
    "norm": "nicotina 2 mg",
    "hslId": 458,
    "hslFarmaco": "NICOTINA"
  },
  {
    "name": "Nicotina 21 mg",
    "norm": "nicotina 21 mg",
    "hslId": 458,
    "hslFarmaco": "NICOTINA"
  },
  {
    "name": "Nicotina 7 mg",
    "norm": "nicotina 7 mg",
    "hslId": 458,
    "hslFarmaco": "NICOTINA"
  },
  {
    "name": "Nimesulida 100 mg",
    "norm": "nimesulida 100 mg"
  },
  {
    "name": "Nistatina 100.000 UI/mL",
    "norm": "nistatina 100.000 ui/ml",
    "hslId": 459,
    "hslFarmaco": "NISTATINA"
  },
  {
    "name": "Nistatina 25.000 UI/g tb.",
    "norm": "nistatina 25.000 ui/g tb.",
    "hslId": 460,
    "hslFarmaco": "NISTATINA (Tópico)"
  },
  {
    "name": "Nitrazepam 5 mg",
    "norm": "nitrazepam 5 mg",
    "hslId": 462,
    "hslFarmaco": "NITRAZEPAM"
  },
  {
    "name": "Nitrofurantoína 100 mg",
    "norm": "nitrofurantoina 100 mg",
    "hslId": 464,
    "hslFarmaco": "NITROFURANTOINA"
  },
  {
    "name": "Noretisterona 0,35 mg",
    "norm": "noretisterona 0,35 mg"
  },
  {
    "name": "Nortriptilina 25 mg",
    "norm": "nortriptilina 25 mg",
    "hslId": 470,
    "hslFarmaco": "NORTRIPTILINA"
  },
  {
    "name": "Ofloxacino 400 mg",
    "norm": "ofloxacino 400 mg"
  },
  {
    "name": "Omeprazol 20 mg",
    "norm": "omeprazol 20 mg",
    "hslId": 480,
    "hslFarmaco": "OMEPRAZOL"
  },
  {
    "name": "Omeprazol 40 mg fr.",
    "norm": "omeprazol 40 mg fr.",
    "hslId": 480,
    "hslFarmaco": "OMEPRAZOL"
  },
  {
    "name": "Oseltamivir 30 mg",
    "norm": "oseltamivir 30 mg",
    "hslId": 491,
    "hslFarmaco": "OSELTAMIVIR"
  },
  {
    "name": "Oseltamivir 45 mg",
    "norm": "oseltamivir 45 mg",
    "hslId": 491,
    "hslFarmaco": "OSELTAMIVIR"
  },
  {
    "name": "Oseltamivir 75 mg",
    "norm": "oseltamivir 75 mg",
    "hslId": 491,
    "hslFarmaco": "OSELTAMIVIR"
  },
  {
    "name": "Paracetamol 200 mg/ml",
    "norm": "paracetamol 200 mg/ml",
    "hslId": 704,
    "hslFarmaco": "PARACETAMOL (ACETAMINOFENO)"
  },
  {
    "name": "Paracetamol 500 mg",
    "norm": "paracetamol 500 mg",
    "hslId": 704,
    "hslFarmaco": "PARACETAMOL (ACETAMINOFENO)"
  },
  {
    "name": "Pentoxifilina 400 mg",
    "norm": "pentoxifilina 400 mg",
    "hslId": 514,
    "hslFarmaco": "PENTOXIFILINA"
  },
  {
    "name": "Pirazinamida 500 mg",
    "norm": "pirazinamida 500 mg"
  },
  {
    "name": "Piridoxina (Vitamina B6) 40 mg",
    "norm": "piridoxina (vitamina b6) 40 mg",
    "hslId": 658,
    "hslFarmaco": "VITAMINA B6 (PIRIDOXINA)"
  },
  {
    "name": "Pirimetamina 25 mg",
    "norm": "pirimetamina 25 mg"
  },
  {
    "name": "Praziquantel 600 mg",
    "norm": "praziquantel 600 mg"
  },
  {
    "name": "Prednisolona 3 mg/mL fr.",
    "norm": "prednisolona 3 mg/ml fr.",
    "hslId": 602,
    "hslFarmaco": "PREDNISOLONA (Colírio)"
  },
  {
    "name": "Prednisona 20 mg",
    "norm": "prednisona 20 mg",
    "hslId": 604,
    "hslFarmaco": "PREDNISONA"
  },
  {
    "name": "Prednisona 5 mg",
    "norm": "prednisona 5 mg",
    "hslId": 604,
    "hslFarmaco": "PREDNISONA"
  },
  {
    "name": "Progesterona 200 mg",
    "norm": "progesterona 200 mg"
  },
  {
    "name": "Prometazina 25 mg",
    "norm": "prometazina 25 mg",
    "hslId": 614,
    "hslFarmaco": "PROMETAZINA"
  },
  {
    "name": "Prometazina 25 mg/mL",
    "norm": "prometazina 25 mg/ml",
    "hslId": 614,
    "hslFarmaco": "PROMETAZINA"
  },
  {
    "name": "Propranolol 40 mg",
    "norm": "propranolol 40 mg",
    "hslId": 619,
    "hslFarmaco": "PROPRANOLOL"
  },
  {
    "name": "Raltegravir 400 mg",
    "norm": "raltegravir 400 mg"
  },
  {
    "name": "Rifabutina 150 mg",
    "norm": "rifabutina 150 mg"
  },
  {
    "name": "Rifampicina 300 mg",
    "norm": "rifampicina 300 mg",
    "hslId": 548,
    "hslFarmaco": "RIFAMPICINA"
  },
  {
    "name": "Rifapentina + isoniazida 300 mg + 300 mg",
    "norm": "rifapentina + isoniazida 300 mg + 300 mg"
  },
  {
    "name": "Rifapentina 150 mg",
    "norm": "rifapentina 150 mg"
  },
  {
    "name": "Ringer com lactato fr. 500 mL",
    "norm": "ringer com lactato fr. 500 ml"
  },
  {
    "name": "Risperidona 2 mg",
    "norm": "risperidona 2 mg",
    "hslId": 624,
    "hslFarmaco": "RISPERIDONA"
  },
  {
    "name": "Ritonavir 100 mg",
    "norm": "ritonavir 100 mg"
  },
  {
    "name": "Salbutamol 100 mcg",
    "norm": "salbutamol 100 mcg",
    "hslId": 814,
    "hslFarmaco": "SALBUTAMOL (INJETÁVEL)"
  },
  {
    "name": "Secnidazol 1 g",
    "norm": "secnidazol 1 g"
  },
  {
    "name": "Seringa para Insulina 100 UI",
    "norm": "seringa para insulina 100 ui"
  },
  {
    "name": "Seringa para Insulina 50 UI",
    "norm": "seringa para insulina 50 ui"
  },
  {
    "name": "Sertralina 50 mg",
    "norm": "sertralina 50 mg",
    "hslId": 632,
    "hslFarmaco": "SERTRALINA"
  },
  {
    "name": "Sinvastatina 20 mg",
    "norm": "sinvastatina 20 mg",
    "hslId": 637,
    "hslFarmaco": "SINVASTATINA"
  },
  {
    "name": "Sofosbuvir + velpatasvir 400 mg + 100 mg",
    "norm": "sofosbuvir + velpatasvir 400 mg + 100 mg"
  },
  {
    "name": "Sofosbuvir 400 mg",
    "norm": "sofosbuvir 400 mg"
  },
  {
    "name": "Sulfadiazina 500 mg",
    "norm": "sulfadiazina 500 mg",
    "hslId": 649,
    "hslFarmaco": "SULFADIAZINA DE PRATA"
  },
  {
    "name": "Sulfato de magnésio 1 mEq/mL",
    "norm": "sulfato de magnesio 1 meq/ml",
    "hslId": 1006,
    "hslFarmaco": "Sulfato de magnésio (Oral)"
  },
  {
    "name": "Sulfato ferroso 25 mg/mL de ferro elementar",
    "norm": "sulfato ferroso 25 mg/ml de ferro elementar",
    "hslId": 196,
    "hslFarmaco": "FERRO (ORAL)"
  },
  {
    "name": "Sulfato ferroso 40 mg de ferro elementar",
    "norm": "sulfato ferroso 40 mg de ferro elementar",
    "hslId": 196,
    "hslFarmaco": "FERRO (ORAL)"
  },
  {
    "name": "Suxametônio cloreto 100 mg fr.",
    "norm": "suxametonio cloreto 100 mg fr.",
    "hslId": 654,
    "hslFarmaco": "SUXAMETÔNIO"
  },
  {
    "name": "Talidomida 100 mg",
    "norm": "talidomida 100 mg"
  },
  {
    "name": "Tenofovir alafenamida 25 mg",
    "norm": "tenofovir alafenamida 25 mg"
  },
  {
    "name": "Tenofovir desoproxila 300 mg",
    "norm": "tenofovir desoproxila 300 mg"
  },
  {
    "name": "Terbutalina sulfato 0,5 mg/mL",
    "norm": "terbutalina sulfato 0,5 mg/ml",
    "hslId": 734,
    "hslFarmaco": "TERBUTALINA"
  },
  {
    "name": "Tiamazol 5 mg",
    "norm": "tiamazol 5 mg",
    "hslId": 732,
    "hslFarmaco": "TIAMAZOL"
  },
  {
    "name": "Tiamina 100 mg (vitamina B1)",
    "norm": "tiamina 100 mg (vitamina b1)",
    "hslId": 657,
    "hslFarmaco": "VITAMINA B1 (TIAMINA)"
  },
  {
    "name": "Tiamina 300 mg (vitamina B1)",
    "norm": "tiamina 300 mg (vitamina b1)",
    "hslId": 657,
    "hslFarmaco": "VITAMINA B1 (TIAMINA)"
  },
  {
    "name": "Tibolona 2,5 mg",
    "norm": "tibolona 2,5 mg"
  },
  {
    "name": "Tioridazina 100 mg",
    "norm": "tioridazina 100 mg",
    "hslId": 768,
    "hslFarmaco": "TIORIDAZINA"
  },
  {
    "name": "Tobramicina 3 mg/mL fr.",
    "norm": "tobramicina 3 mg/ml fr.",
    "hslId": 1032,
    "hslFarmaco": "TOBRamicina Nebulização"
  },
  {
    "name": "Tramadol 50 mg",
    "norm": "tramadol 50 mg",
    "hslId": 795,
    "hslFarmaco": "TRAMADOL (A) + PARACETAMOL (B)"
  },
  {
    "name": "Tramadol 50 mg/mL ap. 2 mL",
    "norm": "tramadol 50 mg/ml ap. 2 ml",
    "hslId": 795,
    "hslFarmaco": "TRAMADOL (A) + PARACETAMOL (B)"
  },
  {
    "name": "Valaciclovir 500 mg",
    "norm": "valaciclovir 500 mg",
    "hslId": 771,
    "hslFarmaco": "VALACICLOVIR"
  },
  {
    "name": "Varfarina sódica 5 mg",
    "norm": "varfarina sodica 5 mg",
    "hslId": 683,
    "hslFarmaco": "VARFARINA"
  },
  {
    "name": "Vecurônio 10 mg fr.",
    "norm": "vecuronio 10 mg fr."
  },
  {
    "name": "Zidovudina + lamivudina 300 mg + 150 mg",
    "norm": "zidovudina + lamivudina 300 mg + 150 mg",
    "hslId": 315,
    "hslFarmaco": "LAMIVUDINA (A) + ZIDOVUDINA (B)"
  },
  {
    "name": "Zidovudina 100 mg",
    "norm": "zidovudina 100 mg"
  },
  {
    "name": "Ácido acetilsalicílico 100 mg",
    "norm": "acido acetilsalicilico 100 mg",
    "hslId": 12,
    "hslFarmaco": "ÁCIDO ACETILSALICÍLICO tamponado"
  },
  {
    "name": "Ácido fólico 0,2 mg/mL",
    "norm": "acido folico 0,2 mg/ml",
    "hslId": 14,
    "hslFarmaco": "ÁCIDO FÓLICO"
  },
  {
    "name": "Ácido fólico 5 mg",
    "norm": "acido folico 5 mg",
    "hslId": 14,
    "hslFarmaco": "ÁCIDO FÓLICO"
  },
  {
    "name": "Ácido tranexâmico 50 mg/mL",
    "norm": "acido tranexamico 50 mg/ml",
    "hslId": 17,
    "hslFarmaco": "ÁCIDO TRANEXÂMICO"
  },
  {
    "name": "Ácido valpróico 250 mg",
    "norm": "acido valproico 250 mg",
    "hslId": 774,
    "hslFarmaco": "VALPROATO DE SÓDIO"
  },
  {
    "name": "Ácido valpróico 250 mg/5 mL",
    "norm": "acido valproico 250 mg/5 ml",
    "hslId": 774,
    "hslFarmaco": "VALPROATO DE SÓDIO"
  },
  {
    "name": "Ácido valpróico 500 mg",
    "norm": "acido valproico 500 mg",
    "hslId": 774,
    "hslFarmaco": "VALPROATO DE SÓDIO"
  },
  {
    "name": "Água Destilada 5 mL fr.",
    "norm": "agua destilada 5 ml fr.",
    "hslId": 22,
    "hslFarmaco": "ÁGUA DESTILADA"
  }
];

export interface DrugClinicalCatalogRule {
  matchPatterns: RegExp[];
  meta: RemumeClinicalMeta;
}

function normalizeDrugLookupText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export const DRUG_CLINICAL_CATALOG: DrugClinicalCatalogRule[] = [
  // ---- AINEs ----
  {
    matchPatterns: [/\bibuprofeno\b/],
    meta: {
      canonicalKey: 'ibuprofeno',
      therapeuticClass: 'aine',
      classLabel: 'AINE',
      duplicityGroup: 'aine',
      renalAdjustment: { required: true, gfrCutoffMlMin: 60, contraindicatedBelowGfr: 30, note: 'Evitar AINE se TFG < 30 mL/min (risco de IRA e hipercalemia).' },
      pregnancyRisk: 'EVITAR_3TRI',
      pregnancyNote: 'Contraindicado após 20-30 semanas (oligoâmnio e fechamento precoce do ducto arterioso).',
      allergyCrossGroups: ['aine', 'ibuprofeno', 'aas', 'anti-inflamatorio', 'antiinflamatorio'],
      maxDailyDoseMg: 2400,
      maxDailyDoseMgPerKg: 40,
      maxSingleDoseMg: 800,
    },
  },
  {
    matchPatterns: [/\bdiclofenaco\b/],
    meta: {
      canonicalKey: 'diclofenaco',
      therapeuticClass: 'aine',
      classLabel: 'AINE',
      duplicityGroup: 'aine',
      renalAdjustment: { required: true, gfrCutoffMlMin: 60, contraindicatedBelowGfr: 30, note: 'Nefrotóxico; evitar se TFG < 30 mL/min.' },
      pregnancyRisk: 'EVITAR_3TRI',
      pregnancyNote: 'Evitar na gestação, especialmente >= 20 semanas (fechamento ductal/oligoâmnio).',
      allergyCrossGroups: ['aine', 'diclofenaco', 'aas', 'anti-inflamatorio', 'antiinflamatorio'],
      maxDailyDoseMg: 150,
      maxSingleDoseMg: 75,
    },
  },
  {
    matchPatterns: [/\bcetoprofeno\b/],
    meta: {
      canonicalKey: 'cetoprofeno',
      therapeuticClass: 'aine',
      classLabel: 'AINE',
      duplicityGroup: 'aine',
      renalAdjustment: { required: true, gfrCutoffMlMin: 60, contraindicatedBelowGfr: 30, note: 'Evitar AINE se TFG < 30 mL/min.' },
      pregnancyRisk: 'EVITAR_3TRI',
      pregnancyNote: 'Contraindicado no 3º trimestre (risco ductal/renal fetal).',
      allergyCrossGroups: ['aine', 'cetoprofeno', 'aas', 'anti-inflamatorio', 'antiinflamatorio'],
      maxDailyDoseMg: 300,
      maxSingleDoseMg: 100,
    },
  },
  {
    matchPatterns: [/\bcetorolaco\b/],
    meta: {
      canonicalKey: 'cetorolaco',
      therapeuticClass: 'aine',
      classLabel: 'AINE',
      duplicityGroup: 'aine',
      renalAdjustment: { required: true, gfrCutoffMlMin: 60, contraindicatedBelowGfr: 30, note: 'Alto risco nefrotóxico; contraindicado se TFG < 30 mL/min.' },
      pregnancyRisk: 'EVITAR_3TRI',
      pregnancyNote: 'Evitar na gestação e no parto (risco de hemorragia e fechamento ductal).',
      allergyCrossGroups: ['aine', 'cetorolaco', 'aas', 'anti-inflamatorio', 'antiinflamatorio'],
      maxDailyDoseMg: 120,
      maxSingleDoseMg: 30,
    },
  },
  {
    matchPatterns: [/\bnimesulida\b/],
    meta: {
      canonicalKey: 'nimesulida',
      therapeuticClass: 'aine',
      classLabel: 'AINE',
      duplicityGroup: 'aine',
      renalAdjustment: { required: true, gfrCutoffMlMin: 60, contraindicatedBelowGfr: 30, note: 'Evitar se TFG < 30 mL/min ou hepatopatia.' },
      pregnancyRisk: 'EVITAR_3TRI',
      pregnancyNote: 'Contraindicado na gestação (risco ductal/oligoâmnio).',
      allergyCrossGroups: ['aine', 'nimesulida', 'aas', 'anti-inflamatorio', 'antiinflamatorio'],
      maxDailyDoseMg: 200,
      maxSingleDoseMg: 100,
    },
  },
  {
    matchPatterns: [/\bnaproxeno\b/],
    meta: {
      canonicalKey: 'naproxeno',
      therapeuticClass: 'aine',
      classLabel: 'AINE',
      duplicityGroup: 'aine',
      renalAdjustment: { required: true, gfrCutoffMlMin: 60, contraindicatedBelowGfr: 30, note: 'Evitar AINE se TFG < 30 mL/min.' },
      pregnancyRisk: 'EVITAR_3TRI',
      pregnancyNote: 'Contraindicado após 20-30 semanas de gestação.',
      allergyCrossGroups: ['aine', 'naproxeno', 'aas', 'anti-inflamatorio', 'antiinflamatorio'],
      maxDailyDoseMg: 1250,
      maxSingleDoseMg: 500,
    },
  },
  {
    matchPatterns: [/\bmeloxicam\b|\btenoxicam\b|\bpiroxicam\b|\bcelecoxib/],
    meta: {
      canonicalKey: 'meloxicam',
      therapeuticClass: 'aine',
      classLabel: 'AINE',
      duplicityGroup: 'aine',
      renalAdjustment: { required: true, gfrCutoffMlMin: 60, contraindicatedBelowGfr: 30, note: 'Evitar AINE se TFG < 30 mL/min.' },
      pregnancyRisk: 'EVITAR_3TRI',
      pregnancyNote: 'Contraindicado na gestação a partir de 20 semanas.',
      allergyCrossGroups: ['aine', 'meloxicam', 'aas', 'anti-inflamatorio', 'antiinflamatorio'],
      maxDailyDoseMg: 15,
      maxSingleDoseMg: 15,
    },
  },
  {
    matchPatterns: [/\bacido acetilsalicilico\b|\baas\b|\baspirina\b/],
    meta: {
      canonicalKey: 'aas',
      therapeuticClass: 'antiplaquetario',
      classLabel: 'Antiplaquetário / Salicilato (AAS)',
      duplicityGroup: 'antiplaquetario_salicilato',
      renalAdjustment: { required: true, gfrCutoffMlMin: 30, contraindicatedBelowGfr: 10, note: 'Evitar doses analgésicas se TFG < 30 mL/min.' },
      pregnancyRisk: 'C',
      pregnancyNote: 'Dose baixa (100 mg) é segura quando indicada (profilaxia PE); doses altas são contraindicadas.',
      allergyCrossGroups: ['aas', 'salicilato', 'aspirina', 'aine'],
      maxDailyDoseMg: 4000,
      maxSingleDoseMg: 1000,
    },
  },
  // ---- Analgésicos não opioides ----
  {
    matchPatterns: [/\bdipirona\b|\bmetamizol\b/],
    meta: {
      canonicalKey: 'dipirona',
      therapeuticClass: 'analgesico_nao_opioide',
      classLabel: 'Analgésico / Pirazolona',
      duplicityGroup: 'dipirona',
      renalAdjustment: { required: false, gfrCutoffMlMin: 30, note: 'Evitar doses elevadas repetidas em DRC grave.' },
      pregnancyRisk: 'C',
      pregnancyNote: 'Preferir Paracetamol como 1ª linha na gestação; evitar uso prolongado no 3º trimestre.',
      allergyCrossGroups: ['dipirona', 'metamizol', 'pirazolona'],
      maxDailyDoseMg: 4000,
      maxDailyDoseMgPerKg: 80,
      maxSingleDoseMg: 1000,
    },
  },
  {
    matchPatterns: [/\bparacetamol\b|\bacetaminofen\b/],
    meta: {
      canonicalKey: 'paracetamol',
      therapeuticClass: 'analgesico_nao_opioide',
      classLabel: 'Analgésico / Antipirético',
      duplicityGroup: 'paracetamol',
      renalAdjustment: { required: false, gfrCutoffMlMin: 30, note: 'Seguro na DRC; alongar intervalo para 8/8h se TFG < 10 mL/min.' },
      pregnancyRisk: 'B',
      pregnancyNote: 'Analgésico de 1ª linha na gestação.',
      allergyCrossGroups: ['paracetamol', 'acetaminofen'],
      maxDailyDoseMg: 4000,
      maxDailyDoseMgPerKg: 75,
      maxSingleDoseMg: 1000,
    },
  },
  // ---- Beta-lactâmicos (Penicilinas) ----
  {
    matchPatterns: [/\bamoxicilina\b.*clavulan|\bclavulanato\b/],
    meta: {
      canonicalKey: 'amoxicilina_clavulanato',
      therapeuticClass: 'beta_lactamico_penicilina',
      classLabel: 'Beta-lactâmico (Penicilina + Inibidor)',
      duplicityGroup: 'beta_lactamico',
      renalAdjustment: { required: true, gfrCutoffMlMin: 30, note: 'Ajustar para 12/12h se TFG 10-30 mL/min; evitar comprimido 875 mg se TFG < 30.' },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['penicilina', 'amoxicilina', 'beta-lactamico', 'betalactamico', 'clavulanato'],
      maxDailyDoseMg: 3000,
      maxDailyDoseMgPerKg: 90,
      maxSingleDoseMg: 1000,
    },
  },
  {
    matchPatterns: [/\bamoxicilina\b/],
    meta: {
      canonicalKey: 'amoxicilina',
      therapeuticClass: 'beta_lactamico_penicilina',
      classLabel: 'Beta-lactâmico (Penicilina)',
      duplicityGroup: 'beta_lactamico',
      renalAdjustment: { required: true, gfrCutoffMlMin: 30, note: 'Ajustar intervalo para 12/12h se TFG 10-30 mL/min e 24/24h se < 10.' },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['penicilina', 'amoxicilina', 'beta-lactamico', 'betalactamico'],
      maxDailyDoseMg: 3000,
      maxDailyDoseMgPerKg: 90,
      maxSingleDoseMg: 1000,
    },
  },
  {
    matchPatterns: [/\bampicilina\b|\bsulbactam\b|\bpiperacilina\b|\boxacilina\b/],
    meta: {
      canonicalKey: 'ampicilina',
      therapeuticClass: 'beta_lactamico_penicilina',
      classLabel: 'Beta-lactâmico (Penicilina)',
      duplicityGroup: 'beta_lactamico',
      renalAdjustment: { required: true, gfrCutoffMlMin: 50, note: 'Ajustar intervalo se TFG < 50 mL/min.' },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['penicilina', 'ampicilina', 'beta-lactamico', 'betalactamico'],
      maxDailyDoseMg: 12000,
      maxDailyDoseMgPerKg: 200,
    },
  },
  {
    matchPatterns: [/\bpenicilina\b|\bbenzilpenicilina\b|\bbenze?tacil\b/],
    meta: {
      canonicalKey: 'penicilina',
      therapeuticClass: 'beta_lactamico_penicilina',
      classLabel: 'Beta-lactâmico (Penicilina)',
      duplicityGroup: 'beta_lactamico',
      renalAdjustment: { required: true, gfrCutoffMlMin: 50, note: 'Reduzir dose em penicilina cristalina se TFG < 50 mL/min.' },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['penicilina', 'benzilpenicilina', 'beta-lactamico', 'betalactamico'],
    },
  },
  // ---- Beta-lactâmicos (Cefalosporinas) ----
  {
    matchPatterns: [/\bcefalexina\b/],
    meta: {
      canonicalKey: 'cefalexina',
      therapeuticClass: 'beta_lactamico_cefalosporina',
      classLabel: 'Beta-lactâmico (Cefalosporina 1ªG)',
      duplicityGroup: 'beta_lactamico',
      renalAdjustment: { required: true, gfrCutoffMlMin: 50, note: 'Ajustar intervalo para 8-12h se TFG < 50 mL/min.' },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['cefalosporina', 'cefalexina'],
      allergyWarnGroups: ['penicilina', 'amoxicilina', 'beta-lactamico', 'betalactamico'],
      maxDailyDoseMg: 4000,
      maxDailyDoseMgPerKg: 100,
      maxSingleDoseMg: 1000,
    },
  },
  {
    matchPatterns: [/\bceftriaxona\b/],
    meta: {
      canonicalKey: 'ceftriaxona',
      therapeuticClass: 'beta_lactamico_cefalosporina',
      classLabel: 'Beta-lactâmico (Cefalosporina 3ªG)',
      duplicityGroup: 'beta_lactamico',
      renalAdjustment: { required: false, note: 'Excreção biliar/renal mista; sem ajuste usual na DRC leve/moderada.' },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['cefalosporina', 'ceftriaxona'],
      allergyWarnGroups: ['penicilina', 'amoxicilina', 'beta-lactamico', 'betalactamico'],
      maxDailyDoseMg: 4000,
      maxDailyDoseMgPerKg: 100,
      maxSingleDoseMg: 2000,
    },
  },
  {
    matchPatterns: [/\bcefuroxima\b|\bcefazolina\b|\bcefalotina\b|\bcefepima\b|\bceftazidima\b/],
    meta: {
      canonicalKey: 'cefalosporina',
      therapeuticClass: 'beta_lactamico_cefalosporina',
      classLabel: 'Beta-lactâmico (Cefalosporina)',
      duplicityGroup: 'beta_lactamico',
      renalAdjustment: { required: true, gfrCutoffMlMin: 50, note: 'Avaliar ajuste de intervalo se TFG < 50 mL/min.' },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['cefalosporina'],
      allergyWarnGroups: ['penicilina', 'amoxicilina', 'beta-lactamico', 'betalactamico'],
      maxDailyDoseMg: 4000,
    },
  },
  // ---- Macrolídeos ----
  {
    matchPatterns: [/\bazitromicina\b|\bclaritromicina\b|\beritromicina\b|\bespiramicina\b/],
    meta: {
      canonicalKey: 'macrolideo',
      therapeuticClass: 'macrolideo',
      classLabel: 'Macrolídeo',
      duplicityGroup: 'macrolideo',
      renalAdjustment: { required: false, gfrCutoffMlMin: 30, note: 'Claritromicina requer redução de 50% se TFG < 30 mL/min; Azitromicina sem ajuste.' },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['macrolideo', 'azitromicina', 'claritromicina', 'eritromicina'],
      maxDailyDoseMg: 1000,
      maxDailyDoseMgPerKg: 20,
    },
  },
  // ---- Fluoroquinolonas ----
  {
    matchPatterns: [/\bciprofloxacin|\blevofloxacin|\bofloxacin|\bnorfloxacin|\bmoxifloxacin/],
    meta: {
      canonicalKey: 'fluoroquinolona',
      therapeuticClass: 'fluoroquinolona',
      classLabel: 'Fluoroquinolona',
      duplicityGroup: 'fluoroquinolona',
      renalAdjustment: { required: true, gfrCutoffMlMin: 50, note: 'Reduzir dose / alongar intervalo se TFG < 50 mL/min.' },
      pregnancyRisk: 'D',
      pregnancyNote: 'Evitar na gestação e pediatria (risco de artropatia cartilaginosa fetal).',
      allergyCrossGroups: ['fluoroquinolona', 'quinolona', 'ciprofloxacino', 'levofloxacino'],
      maxDailyDoseMg: 1500,
      maxSingleDoseMg: 750,
    },
  },
  // ---- Tetraciclinas ----
  {
    matchPatterns: [/\bdoxiciclina\b|\btetraciclina\b|\bminociclina\b/],
    meta: {
      canonicalKey: 'doxiciclina',
      therapeuticClass: 'tetraciclina',
      classLabel: 'Tetraciclina',
      duplicityGroup: 'tetraciclina',
      renalAdjustment: { required: false, note: 'Doxiciclina não requer ajuste renal.' },
      pregnancyRisk: 'D',
      pregnancyNote: 'Contraindicada na gestação e crianças < 8 anos (descoloração dentária e hipoplasia óssea).',
      allergyCrossGroups: ['tetraciclina', 'doxiciclina'],
      maxDailyDoseMg: 200,
      maxSingleDoseMg: 100,
    },
  },
  // ---- Aminoglicosídeos ----
  {
    matchPatterns: [/\bgentamicina\b|\bamicacina\b|\btobramicina\b/],
    meta: {
      canonicalKey: 'aminoglicosideo',
      therapeuticClass: 'aminoglicosideo',
      classLabel: 'Aminoglicosídeo',
      duplicityGroup: 'aminoglicosideo',
      renalAdjustment: { required: true, gfrCutoffMlMin: 60, contraindicatedBelowGfr: 30, note: 'Alto risco nefrotóxico/ototóxico; ajustar rigorosamente pela TFG.' },
      pregnancyRisk: 'D',
      pregnancyNote: 'Risco de ototoxicidade fetal; reservar para infecções graves sem alternativa.',
      allergyCrossGroups: ['aminoglicosideo', 'gentamicina', 'amicacina'],
    },
  },
  // ---- Sulfonamidas ----
  {
    matchPatterns: [/\bsulfametoxazol\b|\bbactrim\b|\bsulfadiazina\b/],
    meta: {
      canonicalKey: 'sulfonamida',
      therapeuticClass: 'sulfonamida',
      classLabel: 'Sulfonamida',
      duplicityGroup: 'sulfonamida',
      renalAdjustment: { required: true, gfrCutoffMlMin: 30, contraindicatedBelowGfr: 15, note: 'Reduzir 50% se TFG 15-30 mL/min; evitar se < 15 mL/min.' },
      pregnancyRisk: 'D',
      pregnancyNote: 'Evitar no 1º trimestre (antagonismo de folato) e 3º trimestre (risco de kernicterus).',
      allergyCrossGroups: ['sulfa', 'sulfonamida', 'sulfametoxazol', 'bactrim'],
      maxDailyDoseMg: 3200,
    },
  },
  // ---- Nitrofurantoína ----
  {
    matchPatterns: [/\bnitrofurantoina\b/],
    meta: {
      canonicalKey: 'nitrofurantoina',
      therapeuticClass: 'nitrofurano',
      classLabel: 'Nitrofurano (Antisséptico urinário)',
      duplicityGroup: 'nitrofurano',
      renalAdjustment: { required: true, gfrCutoffMlMin: 45, contraindicatedBelowGfr: 30, note: 'Contraindicada se TFG < 30 mL/min (ineficaz na urina e toxicidade sistêmica).' },
      pregnancyRisk: 'EVITAR_3TRI',
      pregnancyNote: 'Segura no 1º-2º tri; evitar após 37-38 semanas e no trabalho de parto (risco de anemia hemolítica neonatal).',
      allergyCrossGroups: ['nitrofurantoina', 'nitrofurano'],
      maxDailyDoseMg: 400,
      maxSingleDoseMg: 100,
    },
  },
  // ---- Nitroimidazóis ----
  {
    matchPatterns: [/\bmetronidazol\b|\bsecnidazol\b|\btinidazol\b/],
    meta: {
      canonicalKey: 'metronidazol',
      therapeuticClass: 'nitroimidazol',
      classLabel: 'Nitroimidazol',
      duplicityGroup: 'nitroimidazol',
      renalAdjustment: { required: false, gfrCutoffMlMin: 10, note: 'Ajustar se TFG < 10 mL/min.' },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['metronidazol', 'nitroimidazol'],
      maxDailyDoseMg: 2000,
    },
  },
  // ---- Lincosamidas ----
  {
    matchPatterns: [/\bclindamicina\b/],
    meta: {
      canonicalKey: 'clindamicina',
      therapeuticClass: 'lincosamida',
      classLabel: 'Lincosamida',
      duplicityGroup: 'lincosamida',
      renalAdjustment: { required: false },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['clindamicina', 'lincosamida'],
      maxDailyDoseMg: 2700,
      maxDailyDoseMgPerKg: 40,
    },
  },
  // ---- Corticoides sistêmicos ----
  {
    matchPatterns: [/\bprednisona\b|\bprednisolona\b|\bdexametasona\b|\bhidrocortisona\b|\bbetametasona\b|\bmetilprednisolona\b/],
    meta: {
      canonicalKey: 'corticoide',
      therapeuticClass: 'corticoide',
      classLabel: 'Corticosteroide sistêmico',
      duplicityGroup: 'corticoide',
      renalAdjustment: { required: false },
      pregnancyRisk: 'C',
      allergyCrossGroups: ['corticoide', 'prednisona', 'dexametasona'],
      maxDailyDoseMgPerKg: 2,
    },
  },
  // ---- IBP ----
  {
    matchPatterns: [/\bomeprazol\b|\bpantoprazol\b|\besomeprazol\b|\blansoprazol\b/],
    meta: {
      canonicalKey: 'ibp',
      therapeuticClass: 'ibp',
      classLabel: 'Inibidor de Bomba de Prótons (IBP)',
      duplicityGroup: 'ibp',
      renalAdjustment: { required: false },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['ibp', 'omeprazol'],
      maxDailyDoseMg: 80,
    },
  },
  // ---- Opioides ----
  {
    matchPatterns: [/\bmorfina\b|\btramadol\b|\bcodeina\b|\bfentanil|\bmetadona\b/],
    meta: {
      canonicalKey: 'opioide',
      therapeuticClass: 'opioide',
      classLabel: 'Opioide',
      duplicityGroup: 'opioide',
      renalAdjustment: { required: true, gfrCutoffMlMin: 50, contraindicatedBelowGfr: 15, note: 'Acúmulo de metabólitos ativos na DRC (sedação/depressão respiratória); reduzir dose ou preferir fentanil.' },
      pregnancyRisk: 'C',
      allergyCrossGroups: ['opioide', 'morfina', 'tramadol', 'codeina'],
      maxDailyDoseMg: 400,
    },
  },
  // ---- Benzodiazepínicos ----
  {
    matchPatterns: [/\bdiazepam\b|\bclonazepam\b|\bmidazolam\b|\blorazepam\b|\balprazolam\b|\bnitrazepam\b/],
    meta: {
      canonicalKey: 'benzodiazepinico',
      therapeuticClass: 'benzodiazepinico',
      classLabel: 'Benzodiazepínico',
      duplicityGroup: 'benzodiazepinico',
      renalAdjustment: { required: true, gfrCutoffMlMin: 30, note: 'Risco de sedação prolongada em DRC.' },
      pregnancyRisk: 'D',
      pregnancyNote: 'Evitar na gestação (risco de síndrome de abstinência/hipotonia neonatal).',
      allergyCrossGroups: ['benzodiazepinico', 'diazepam', 'clonazepam'],
    },
  },
  // ---- Anticonvulsivantes / Teratogênicos ----
  {
    matchPatterns: [/\bacido valproico\b|\bvalproato\b/],
    meta: {
      canonicalKey: 'valproato',
      therapeuticClass: 'anticonvulsivante',
      classLabel: 'Anticonvulsivante (Valproato)',
      duplicityGroup: 'anticonvulsivante',
      renalAdjustment: { required: false },
      pregnancyRisk: 'X',
      pregnancyNote: 'ALTO RISCO TERATOGÊNICO (defeitos do tubo neural e neurodesenvolvimento). Contraindicado na gestação.',
      allergyCrossGroups: ['valproato', 'acido valproico'],
      maxDailyDoseMg: 3000,
    },
  },
  {
    matchPatterns: [/\bcarbamazepina\b|\bfenitoina\b|\bfenobarbital\b|\bcarbonato de litio\b|\blitio\b/],
    meta: {
      canonicalKey: 'anticonvulsivante_risco',
      therapeuticClass: 'anticonvulsivante',
      classLabel: 'Anticonvulsivante / Estabilizador',
      duplicityGroup: 'anticonvulsivante',
      renalAdjustment: { required: true, gfrCutoffMlMin: 50, note: 'Lítio exige monitoramento rigoroso/evitar se TFG < 30 mL/min.' },
      pregnancyRisk: 'D',
      pregnancyNote: 'Risco teratogênico conhecido; avaliar relação risco-benefício e ácido fólico 5 mg.',
      allergyCrossGroups: ['carbamazepina', 'fenitoina', 'fenobarbital', 'litio'],
    },
  },
  // ---- IECA / BRA ----
  {
    matchPatterns: [/\benalapril\b|\bcaptopril\b|\blisinopril\b|\bramipril\b/],
    meta: {
      canonicalKey: 'ieca',
      therapeuticClass: 'ieca',
      classLabel: 'IECA',
      duplicityGroup: 'bloqueio_sraa',
      renalAdjustment: { required: true, gfrCutoffMlMin: 30, note: 'Monitorar Cr e K+; evitar início ou suspender se elevação de Cr > 30% ou K+ > 5,5.' },
      pregnancyRisk: 'D',
      pregnancyNote: 'CONTRAINDICADO NA GESTAÇÃO (fetotoxicidade renal, oligoâmnio, anúria fetal). Preferir Metildopa/Nifedipino.',
      allergyCrossGroups: ['ieca', 'enalapril', 'captopril'],
      maxDailyDoseMg: 150,
    },
  },
  {
    matchPatterns: [/\blosartana\b|\bvalsartana\b|\bcandesartana\b|\bolmesartana\b/],
    meta: {
      canonicalKey: 'bra',
      therapeuticClass: 'bra',
      classLabel: 'BRA',
      duplicityGroup: 'bloqueio_sraa',
      renalAdjustment: { required: true, gfrCutoffMlMin: 30, note: 'Monitorar Cr e K+; evitar associação com IECA.' },
      pregnancyRisk: 'D',
      pregnancyNote: 'CONTRAINDICADO NA GESTAÇÃO (fetotoxicidade renal/oligoâmnio). Preferir Metildopa/Nifedipino.',
      allergyCrossGroups: ['bra', 'losartana'],
      maxDailyDoseMg: 100,
    },
  },
  // ---- Antidiabéticos ----
  {
    matchPatterns: [/\bmetformina\b/],
    meta: {
      canonicalKey: 'metformina',
      therapeuticClass: 'biguanida',
      classLabel: 'Biguanida (Metformina)',
      duplicityGroup: 'biguanida',
      renalAdjustment: { required: true, gfrCutoffMlMin: 45, contraindicatedBelowGfr: 30, note: 'Reduzir dose (máx 1000 mg/dia) se TFG 30-45; CONTRAINDICADA se TFG < 30 mL/min (acidose láctica).' },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['metformina'],
      maxDailyDoseMg: 2550,
    },
  },
  {
    matchPatterns: [/\bglibenclamida\b|\bgliclazida\b|\bglimepirida\b/],
    meta: {
      canonicalKey: 'sulfonilureia',
      therapeuticClass: 'sulfonilureia',
      classLabel: 'Sulfonilureia',
      duplicityGroup: 'sulfonilureia',
      renalAdjustment: { required: true, gfrCutoffMlMin: 45, contraindicatedBelowGfr: 30, note: 'Alto risco de hipoglicemia grave se TFG < 30 mL/min (especialmente Glibenclamida).' },
      pregnancyRisk: 'C',
      allergyCrossGroups: ['sulfonilureia', 'glibenclamida', 'gliclazida'],
    },
  },
  // ---- Anticoagulantes / Antiplaquetários ----
  {
    matchPatterns: [/\bvarfarina\b/],
    meta: {
      canonicalKey: 'varfarina',
      therapeuticClass: 'anticoagulante',
      classLabel: 'Anticoagulante Oral (Varfarina)',
      duplicityGroup: 'anticoagulante',
      renalAdjustment: { required: false },
      pregnancyRisk: 'X',
      pregnancyNote: 'Teratogênica no 1º trimestre (síndrome varfarínica) e risco hemorrágico fetal; preferir HBPM.',
      allergyCrossGroups: ['varfarina'],
    },
  },
  {
    matchPatterns: [/\benoxaparina\b|\bheparina\b|\brivaroxabana\b|\bapixabana\b|\bdabigatrana\b/],
    meta: {
      canonicalKey: 'anticoagulante_heparina',
      therapeuticClass: 'anticoagulante',
      classLabel: 'Anticoagulante',
      duplicityGroup: 'anticoagulante',
      renalAdjustment: { required: true, gfrCutoffMlMin: 30, note: 'Enoxaparina exige ajuste (1 mg/kg 1x/dia) se ClCr < 30 mL/min.' },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['heparina', 'enoxaparina'],
    },
  },
  {
    matchPatterns: [/\bclopidogrel\b|\bticagrelor\b|\bprasugrel\b/],
    meta: {
      canonicalKey: 'clopidogrel',
      therapeuticClass: 'antiplaquetario',
      classLabel: 'Antiplaquetário (Inibidor P2Y12)',
      duplicityGroup: 'antiplaquetario_p2y12',
      renalAdjustment: { required: false },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['clopidogrel'],
      maxDailyDoseMg: 600,
    },
  },
  // ---- Estatinas & Teratogênicos especiais ----
  {
    matchPatterns: [/\bsinvastatina\b|\batorvastatina\b|\brosuvastatina\b/],
    meta: {
      canonicalKey: 'estatina',
      therapeuticClass: 'estatina',
      classLabel: 'Estatina',
      duplicityGroup: 'estatina',
      renalAdjustment: { required: true, gfrCutoffMlMin: 30, note: 'Limitar dose em DRC avançada.' },
      pregnancyRisk: 'X',
      pregnancyNote: 'CONTRAINDICADA NA GESTAÇÃO (suspender imediatamente).',
      allergyCrossGroups: ['estatina', 'sinvastatina', 'atorvastatina'],
      maxDailyDoseMg: 80,
    },
  },
  {
    matchPatterns: [/\btalidomida\b|\bmisoprostol\b|\bmetotrexato\b|\bisotretinoina\b/],
    meta: {
      canonicalKey: 'teratogenico_x',
      therapeuticClass: 'teratogenico_especial',
      classLabel: 'Fármaco Categoria X',
      duplicityGroup: 'teratogenico_x',
      renalAdjustment: { required: true, gfrCutoffMlMin: 50 },
      pregnancyRisk: 'X',
      pregnancyNote: 'CONTRAINDICADO NA GESTAÇÃO (alto risco teratogênico / abortivo).',
      allergyCrossGroups: [],
    },
  },
  // ---- Diuréticos / Cardiovasculares ----
  {
    matchPatterns: [/\bespironolactona\b/],
    meta: {
      canonicalKey: 'espironolactona',
      therapeuticClass: 'diuretico',
      classLabel: 'Diurético Poupador de K+',
      duplicityGroup: 'diuretico_poupador_k',
      renalAdjustment: { required: true, gfrCutoffMlMin: 45, contraindicatedBelowGfr: 30, note: 'Alto risco de hipercalemia grave se TFG < 30 mL/min.' },
      pregnancyRisk: 'D',
      pregnancyNote: 'Efeito antiandrogênico fetal; evitar na gestação.',
      allergyCrossGroups: ['espironolactona'],
      maxDailyDoseMg: 400,
    },
  },
  {
    matchPatterns: [/\bfurosemida\b|\bhidroclorotiazida\b/],
    meta: {
      canonicalKey: 'diuretico_tiazidico_alca',
      therapeuticClass: 'diuretico',
      classLabel: 'Diurético',
      duplicityGroup: 'diuretico',
      renalAdjustment: { required: true, gfrCutoffMlMin: 30, note: 'Tiazídicos perdem eficácia se TFG < 30 mL/min.' },
      pregnancyRisk: 'C',
      allergyCrossGroups: ['furosemida', 'hidroclorotiazida'],
    },
  },
  {
    matchPatterns: [/\batenolol\b|\bpropranolol\b|\bcarvedilol\b|\bmetoprolol\b/],
    meta: {
      canonicalKey: 'betabloqueador',
      therapeuticClass: 'betabloqueador',
      classLabel: 'Betabloqueador',
      duplicityGroup: 'betabloqueador',
      renalAdjustment: { required: true, gfrCutoffMlMin: 35, note: 'Atenolol requer ajuste de dose se TFG < 35 mL/min.' },
      pregnancyRisk: 'C',
      pregnancyNote: 'Atenolol associado a RCIU na gestação; preferir Labetalol/Metildopa/Nifedipino.',
      allergyCrossGroups: ['betabloqueador'],
    },
  },
  {
    matchPatterns: [/\banlodipino\b|\bnifedipino\b/],
    meta: {
      canonicalKey: 'bcc',
      therapeuticClass: 'bcc',
      classLabel: 'Bloqueador de Canal de Cálcio',
      duplicityGroup: 'bcc',
      renalAdjustment: { required: false },
      pregnancyRisk: 'C',
      allergyCrossGroups: ['bcc', 'anlodipino', 'nifedipino'],
    },
  },
  {
    matchPatterns: [/\bdigoxina\b|\bamiodarona\b/],
    meta: {
      canonicalKey: 'antiarritmico',
      therapeuticClass: 'antiarritmico',
      classLabel: 'Antiarrítmico / Digitálico',
      duplicityGroup: 'antiarritmico',
      renalAdjustment: { required: true, gfrCutoffMlMin: 50, note: 'Digoxina exige redução rigorosa de dose se TFG < 50 mL/min (intoxicação digitálica).' },
      pregnancyRisk: 'D',
      pregnancyNote: 'Amiodarona é categoria D na gestação (hipotireoidismo fetal).',
      allergyCrossGroups: ['digoxina', 'amiodarona'],
    },
  },
  // ---- Antieméticos ----
  {
    matchPatterns: [/\bondansetrona\b|\bmetoclopramida\b|\bbromoprida\b|\bdomperidona\b/],
    meta: {
      canonicalKey: 'antiemetico',
      therapeuticClass: 'antiemetico',
      classLabel: 'Antiemético',
      duplicityGroup: 'antiemetico',
      renalAdjustment: { required: false, gfrCutoffMlMin: 40, note: 'Metoclopramida: reduzir 50% se ClCr < 40 mL/min.' },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['metoclopramida', 'ondansetrona', 'bromoprida'],
      maxDailyDoseMg: 30,
    },
  },
  // ---- Anti-histamínicos ----
  {
    matchPatterns: [/\bloratadina\b|\bdexclorfeniramina\b|\bprometazina\b|\bhidroxizina\b|\bcetirizina\b/],
    meta: {
      canonicalKey: 'anti_histaminico',
      therapeuticClass: 'anti_histaminico',
      classLabel: 'Anti-histamínico',
      duplicityGroup: 'anti_histaminico',
      renalAdjustment: { required: false },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['anti-histaminico', 'prometazina', 'loratadina'],
    },
  },
  // ---- Broncodilatadores ----
  {
    matchPatterns: [/\bsalbutamol\b|\bfenoterol\b|\bterbutalina\b|\bformoterol\b/],
    meta: {
      canonicalKey: 'broncodilatador',
      therapeuticClass: 'broncodilatador',
      classLabel: 'Beta-2 Agonista (Broncodilatador)',
      duplicityGroup: 'broncodilatador_b2',
      renalAdjustment: { required: false },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['salbutamol'],
    },
  },
  // ---- Antivirais / Antifúngicos / Antigotosos / Antiparasitários ----
  {
    matchPatterns: [/\baciclovir\b|\bvalaciclovir\b/],
    meta: {
      canonicalKey: 'aciclovir',
      therapeuticClass: 'antiviral',
      classLabel: 'Antiviral (Aciclovir)',
      duplicityGroup: 'antiviral',
      renalAdjustment: { required: true, gfrCutoffMlMin: 50, note: 'Ajustar intervalo se TFG < 50 mL/min (risco de nefropatia cristalina e neurotoxicidade).' },
      pregnancyRisk: 'B',
      allergyCrossGroups: ['aciclovir'],
      maxDailyDoseMg: 4000,
    },
  },
  {
    matchPatterns: [/\bfluconazol\b|\bitraconazol\b|\bcetoconazol\b/],
    meta: {
      canonicalKey: 'antifungico_azol',
      therapeuticClass: 'antifungico',
      classLabel: 'Antifúngico Azólico',
      duplicityGroup: 'antifungico_azol',
      renalAdjustment: { required: true, gfrCutoffMlMin: 50, note: 'Fluconazol: reduzir 50% da dose de manutenção se TFG < 50 mL/min.' },
      pregnancyRisk: 'D',
      pregnancyNote: 'Fluconazol oral deve ser evitado na gestação (preferir azólico tópico vaginal).',
      allergyCrossGroups: ['fluconazol', 'azolico'],
    },
  },
  {
    matchPatterns: [/\balopurinol\b|\bcolchicina\b/],
    meta: {
      canonicalKey: 'antigotoso',
      therapeuticClass: 'antigotoso',
      classLabel: 'Antigotoso',
      duplicityGroup: 'antigotoso',
      renalAdjustment: { required: true, gfrCutoffMlMin: 50, contraindicatedBelowGfr: 15, note: 'Ajustar dose rigorosamente pela TFG (risco de toxicidade grave).' },
      pregnancyRisk: 'C',
      allergyCrossGroups: ['alopurinol', 'colchicina'],
    },
  },
  {
    matchPatterns: [/\balbendazol\b|\bivermectina\b|\bmebendazol\b/],
    meta: {
      canonicalKey: 'antiparasitario',
      therapeuticClass: 'antiparasitario',
      classLabel: 'Antiparasitário',
      duplicityGroup: 'antiparasitario',
      renalAdjustment: { required: false },
      pregnancyRisk: 'D',
      pregnancyNote: 'Evitar no 1º trimestre de gestação.',
      allergyCrossGroups: ['albendazol', 'ivermectina'],
    },
  },
];

/**
 * Resolve metadados clínicos estruturados a partir do nome ou texto da prescrição
 * (cobre tanto os 252 itens da REMUME quanto fármacos comuns fora da REMUME como Ibuprofeno/Enoxaparina).
 */
export function getDrugClinicalMeta(drugNameOrText: string): RemumeClinicalMeta | null {
  const norm = normalizeDrugLookupText(drugNameOrText);
  if (!norm) return null;
  for (const rule of DRUG_CLINICAL_CATALOG) {
    if (rule.matchPatterns.some((rx) => rx.test(norm))) {
      return rule.meta;
    }
  }
  return null;
}

// Hidrata automaticamente todos os 252 itens da REMUME com seus metadados clínicos tipados
for (const item of REMUME_ITEMS) {
  const meta = getDrugClinicalMeta(`${item.name} ${item.hslFarmaco || ''}`);
  if (meta) {
    item.clinicalMeta = meta;
  }
}

