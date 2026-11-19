# Atendimento de Pronto Atendimento - Dor Torácica Aguda e SCA (Protocolo de 10 Minutos)
**Categoria:** Pronto Atendimento / UPA Adulto  
**Atalho:** `;sca`  
**Gravidade:** Emergência (Vermelho)  
**CID-10:** I21.9 / I20.0  

---

## 📋 Snippet para Prontuário Eletrônico (PEP)

```text
# IDENTIFICAÇÃO:
ID: [Nome], [Idade] anos, Sexo: [Masculino / Feminino][? Peso :: , Peso: [ ] kg].
Comorbidades: [+ *Hígido(a) / [ ]].
Alergias: [*Nega alergias / Alérgico a AAS / Alérgico a Dipirona / [ ]].
# HORÁRIO DE CHEGADA: [HH:MM] | HORÁRIO DO ECG: [HH:MM] (Porta-ECG <= 10 minutos: atendido).

# QP:
- Dor no peito em aperto / queimação iniciada há [ ] horas/minutos.

# HMA:
Paciente refere [dor retroesternal opressiva em aperto / dor em peso / queimação retroesternal intensa / dor em pontada ventilatório-dependente], de intensidade [ ]/10, iniciada [em repouso / aos esforços físicos / após estresse emocional], com irradiação para [membro superior esquerdo / mandíbula / dorso interescapular / região epigástrica / sem irradiação], associada a [sudorese fria, náuseas, vômitos, palidez e dispneia / ausência de sintomas autonômicos].
Fatores de risco cardiovasculares: [HAS, DM2, tabagismo, dislipidemia / história familiar precoce de DAC / DAC ou IAM prévio / nega fatores de risco conhecidos]. Nega dor hiperaguda em rasgadura irradiada para dorso, imobilização recente ou edema assimétrico de MMII, vômitos violentos precedentes e nega uso de inibidores da PDE-5 (sildenafil nas últimas 24h ou tadalafil nas últimas 48h).

# EXAME FÍSICO:
- SINAIS VITAIS: PA MSD: [ ]x[ ] mmHg | PA MSE: [ ]x[ ] mmHg | FC: [ ] bpm | FR: [ ] irpm | SpO2: [ ]% em AA.
- Ectoscopia: [*Lúcido, orientado / Ansioso, sudoreico e pálido], perfusão periférica com tempo de enchimento capilar < 2s, pulsos radiais e femorais simétricos bilateralmente.
- Aparelho Cardiovascular: Ritmo cardíaco regular em 2 tempos, bulhas normofonéticas, ausência de sopros, ausência de B3 ou B4 de disfunção ventricular, ausência de atrito pericárdico. Ausência de estase jugular a 45 graus.
- Aparelho Respiratório: Murmúrio vesicular universalmente audível bilateralmente, sem ruídos adventícios (ausência de estertores crepitantes em bases pulmonares - Killip I).
- Abdome: Flácido, indolor à palpação, sem massas pulsáteis abdominais.

# LAUDO DO ELETROCARDIOGRAMA DE 12 DERIVAÇÕES (REALIZADO EM < 10 MINUTOS):
- Ritmo: [Sinusal regular], FC: [ ] bpm.
- Análise de Isquemia / Lesão / Necrose:
  * IAM COM SUPRADESNIVELAMENTO DO SEGMENTO ST (IAMCSST): Supradesnivelamento de ST >= 1 mm em duas derivações contíguas em parede: [Anterior (V1-V4) / Inferior (DII, DIII, aVF - conferidas derivações direitas V3R/V4R) / Lateral (DI, aVL, V5, V6) / Dorsal].
  * IAM SEM SUPRADESNIVELAMENTO DO SEGMENTO ST (IAMSSST) / ANGINA INSTÁVEL: [Infradesnivelamento de segmento ST >= 0,5 mm / Inversão simétrica de onda T / ECG sem alterações isquêmicas agudas evidentes].

# ESTRATIFICAÇÃO DE RISCO (HEART SCORE PARA DOR TORÁCICA NA UPA):
- H (History / História): [0: Pouco suspeita / 1: Moderadamente suspeita / 2: Altamente suspeita] = [ ] pts.
- E (ECG): [0: Normal / 1: Alteração inespecífica de repolarização / 2: Desvio significativo de ST] = [ ] pts.
- A (Age / Idade): [0: < 45 anos / 1: 45-64 anos / 2: >= 65 anos] = [ ] pts.
- R (Risk factors / Fatores de risco): [0: Nenhum / 1: 1 a 2 fatores / 2: >= 3 fatores ou DAC prévia] = [ ] pts.
- T (Troponin / Troponina): [0: Normal / 1: 1 a 3x limite normal / 2: > 3x limite normal] = [ ] pts.
* HEART SCORE TOTAL: [ ] PONTOS ([0-3: Baixo Risco / 4-6: Risco Moderado / 7-10: Alto Risco]).

# HIPÓTESES DIAGNÓSTICAS:
1. Síndrome Coronariana Aguda [COM Supra de ST em parede / SEM Supra de ST / Angina Instável] (CID-10: I21.0 / I21.4 / I20.0).
2. Classificação Hemodinâmica de Killip-Kimball: Classe [I (sem sinais de congestão) / II / III / IV (choque cardiogênico)].

# CONDUTA:

1. MONITORIZAÇÃO & SUPORTE:
   - Monitor cardíaco contínuo, oximetria de pulso, acesso venoso periférico calibroso.
   - Oxigenoterapia: APENAS SE SpO2 < 90% (evitar hiperóxia e vasoconstrição coronariana paradoxal).

2. DUPLA ANTIAGREGAÇÃO PLAQUETÁRIA (DAPT) DE IMEDIATO:
   - Ácido Acetilsalicílico (AAS) 200 a 300 mg (2 a 3 comprimidos de 100 mg) VO mastigados agora.
   - + Inibidor de P2Y12 conforme a estratégia de reperfusão:
     * SE ANGIOPLASTIA PRIMÁRIA / CATETERISMO PLANEJADO (OU SEM SUPRA DE ST):
       - Ticagrelor 90 mg: 2 comprimidos (180 mg) VO de ataque [PREFERENCIAL].
       - [OU Clopidogrel 75 mg: 4 a 8 comprimidos (300 a 600 mg) VO de ataque se contraindicação ao Ticagrelor].
     * SE TROMBÓLISE QUÍMICA NA UPA (TENECTEPLASE / ALTEPLASE):
       - [ATENÇÃO: TICAGRELOR É PROIBIDO COM FIBRINOLÍTICO. USAR EXCLUSIVAMENTE CLOPIDOGREL]:
       - Clopidogrel 75 mg se idade <= 75 anos: 4 comprimidos (300 mg) VO de ataque imediato.
       - Clopidogrel 75 mg se idade > 75 anos: 1 comprimido (75 mg) VO de manutenção SEM dose de ataque.

3. VASODILATADOR CORONARIANO / CONTROLE DA DOR:
   - Dinitrato de Isossorbida 5 mg sublingual agora (pode repetir a cada 5 min, até 3 doses, se PAS > 100 mmHg).
   - [OU]: Nitroglicerina EV contínua em bomba de infusão se dor refratária ou congestão pulmonar.
   - [CONTRAINDICADO SE PAS < 90 MMHG OU INFARTO DE VENTRÍCULO DIREITO].

4. ANTICOAGULAÇÃO PARENTERAL PLENA (ENOXAPARINA):
   - Se idade < 75 anos: Bólus de 30 mg EV + 1 mg/kg SC de 12/12 horas (iniciar dose SC 15 min após o bólus).
   - Se idade >= 75 anos: SEM bólus EV. Dose reduzida para 0,75 mg/kg SC de 12/12 horas.
   - Se disfunção renal grave (ClCr < 30 mL/min): 1 mg/kg SC 1x ao dia (sem bólus EV se idoso).

5. ESTATINA DE ALTA POTÊNCIA:
   - Atorvastatina 80 mg VO de imediato.

6. [SE IAM COM SUPRADESNIVELAMENTO DE ST]:
   - ATIVAÇÃO IMEDIATA DA LINHA DE CUIDADO DE IAM / REGULAÇÃO URGENTE PARA CATETERISMO CARDÍACO (ANGIOPLASTIA PRIMÁRIA) COM TEMPO PORTA-BALÃO < 90-120 MINUTOS.
   - [Se tempo até angioplastia > 120 minutos]: Avaliar terapia fibrinolítica imediata com Tenecteplase (TNK) ou Alteplase (rt-PA) na UPA com tempo porta-agulha < 30 minutos associada a Clopidogrel (sem Ticagrelor) e Enoxaparina ajustada.
```

---

## 🎯 Diretrizes & Raciocínio Clínico

### 🧠 1. Por Que o ECG Deve Ser Feito em Menos de 10 Minutos e Por Que o Nitrato Pode Matar no Infarto de Parede Inferior? (Fisiopatologia & Raciocínio)
- **Tempo é Músculo Miocárdico (Meta Porta-ECG ≤ 10 min):** Na oclusão trombótica aguda de uma artéria coronária epicárdica (**IAM com Supradesnivelamento de ST — IAMCSST**), a necrose miocárdica avança como uma onda da região subendocárdica para a subepicárdica. Realizar e laudar o ECG de 12 derivações em **até 10 minutos da chegada** permite acionar imediatamente a **Angioplastia Primária (meta Porta-Balão ≤ 90 min; ou ≤ 120 min se transferência)** ou a **Fibrinólise Química (meta Porta-Agulha ≤ 30 min)** caso não haja hemodinâmica disponível em 120 minutos.
- **A Armadilha Fatal do Nitrato (Isordil / Tridil) no Infarto de Ventrículo Direito (`DII, DIII, aVF` + `V3R, V4R`):** Cerca de 40% dos infartos inferiores por oclusão proximal da Artéria Coronária Direita acometem o **Ventrículo Direito (VD)**. O VD infartado perde sua contratilidade e torna-se **estritamente dependente da pré-carga (retorno venoso)** para conseguir empurrar o sangue pelo pulmão até o átrio esquerdo. Se você der **Dinitrato de Isossorbida (Isordil sublingual), Nitroglicerina (Tridil), Morfina ou Furosemida**, a venodilatação sistêmica zera o retorno venoso para o VD, provocando **choque cardiogênico refratário e parada cardiorrespiratória imediata**!
  - **Regra de Ouro:** Em todo supra ou isquemia de parede inferior (`DII, DIII, aVF`), **rode imediatamente as derivações direitas (`V3R` e `V4R`)** e **pergunte sobre uso de Sildenafila/Tadalafila nas últimas 24–48h** antes de cogitar nitrato! Se houver infarto de VD (`supra ≥ 1 mm em V4R` + hipotensão + turgência jugular + **pulmões limpos**), o tratamento é **expansão volêmica cautelosa com SF 0,9% (250–500 mL)** e reperfusão coronariana imediata!

### 🧭 3. Localização Anatômica das Paredes no ECG e Escore HEART para Dor Torácica na UPA
| Parede Miocárdica no ECG | Derivações com Supra de ST | Artéria Culpada Provável | Cuidado Específico Obrigatório |
| :--- | :--- | :--- | :--- |
| **Parede Anterior Extensa** | `V1 a V6`, `DI` e `aVL` | Tronco da CE ou **DA proximal** | Alto risco de **Edema Agudo de Pulmão (Killip III)** e **Choque Cardiogênico (Killip IV)**; evitar betabloqueador precoce. |
| **Parede Anteroseptal / Anterior** | `V1 a V4` | **Artéria Descendente Anterior (DA)** | Vigiar bloqueios de ramo novo (BRE/BRD) e disfunção sistólica de VE. |
| **Parede Lateral** | `DI, aVL, V5, V6` | **Artéria Circunflexa (CX)** | Se infra de ST em `V1–V3` com onda R ampla → **Rodar `V7, V8, V9` (IAM Dorsal/Posterior)**. |
| **Parede Inferior (+ VD)** | `DII, DIII, aVF` *(+ `V3R, V4R`)* | **Artéria Coronária Direita (ACD)** (85%) ou CX | **Rodar `V3R` e `V4R` sempre!** **PROIBIDO Nitrato/Morfina/Diurético se acometer VD!** Vigiar BAVT/bradicardia vagal. |

### 💊 2. Por Que Mastigamos o AAS (300 mg) e Quando Damos Clopidogrel 300 mg vs 600 mg vs Ticagrelor? (Racional Farmacológico)
- **Por que o AAS (`300 mg` = 3 comprimidos infantis de 100 mg) deve ser MASTIGADO e engolido imediatamente:** Mastigar os comprimidos de ácido acetilsalicílico não tamponado promove absorção rápida pela mucosa oral e gástrica, atingindo inibição irreversível da `COX-1` plaquetária e bloqueio do **Tromboxano A2** em **15 a 20 minutos** (em vez de 60 minutos se engolido inteiro), reduzindo isoladamente a mortalidade do IAM em **23% (Estudo ISIS-2)**!
- **A escolha da Dupla Antiagregação Plaquetária (Inibidor P2Y12) conforme a estratégia e a idade:**
  - **Se vai para Angioplastia Primária (ICP):** **Ticagrelor `180 mg VO` ataque** (2 cp de 90 mg) **OU Clopidogrel `600 mg VO` ataque** (8 cp de 75 mg).
  - **Se vai receber Trombólise Química (Tenecteplase / Alteplase):** Usar exclusivamente **Clopidogrel**:
    * Paciente **`≤ 75 anos`**: Ataque de **`300 mg VO`** (4 comprimidos de 75 mg).
    * Paciente **`> 75 anos`**: **NÃO fazer dose de ataque!** Administrar apenas **1 comprimido de `75 mg VO`** (evita hemorragia intracraniana no idoso trombolisado!).
- **Por que NÃO damos Oxigênio se `SpO2 ≥ 90%` nem Morfina/Betabloqueador indiscriminadamente:**
  - **Oxigênio suplementar em normoxêmicos (`SpO2 ≥ 90%` — Estudo DETO2X-AMI):** A hiperóxia gera radicais livres de oxigênio que causam **vasoconstrição coronariana paradoxal** e aumentam a lesão de reperfusão. Só dê O2 se `SpO2 < 90%`!
  - **Betabloqueador nas primeiras 24h (Estudo COMMIT):** Nunca fazer metoprolol EV ou VO de ataque se o paciente tiver **estertores pulmonares (Killip ≥ II), `FC > 110 bpm`, `PAS < 100 mmHg`, `PR > 0,24s` ou história de broncoespasmo**, pois precipita choque cardiogênico!
