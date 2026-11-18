# Protocolo de Atendimento: Evolução Diária SOAP - Clínica Médica
**Categoria:** Evolução Diária SOAP  
**Atalho:** `;enf-evo-clin`  
**Gravidade:** Enfermaria / Internação  
**CID-10:** Z76.9  

---

## 📋 Snippet para Prontuário Eletrônico (PEP)

```text
# IDENTIFICAÇÃO:
- Paciente: [Nome], [Idade] anos[? Leito :: | Leito: ___] | [ ]º Dia de Internação Hospitalar (DIH)
- Diagnóstico Principal Ativo: [ ]
- Antimicrobiano em Curso: [Sem antibioticoterapia ativa / Em uso de ___]
- Dispositivos Atuais: [Acesso venoso periférico em MSD / MSE D ___ / Cateter Venoso Central D ___ / Sonda Vesical de Demora D ___ / Sem dispositivos invasivos]

# HISTÓRIA / RESUMO DA INTERNAÇÃO:
[ ]
[DD/MM/AAAA] | Evolução prévia até ontem: [ ]

# EVOLUÇÃO (24H):
[Passou as últimas 24h estável, sem / Apresentou queixa de no período].
[EVA 0 — Nega dor / Dor leve (EVA ___ ) em ___ , controlada com].
Sono, Apetite e Tolerância Oral: Padrão de sono [preservado / prejudicado por insônia]; Dieta por via oral [com boa aceitação plena (> 75%), sem náuseas ou / aceitação parcial / inapetência].
Nega dor torácica, palpitações, dispneia em repouso ou ortopneia, calafrios, tontura postural ou sangramentos.
Eliminações Fisiológicas:
[Presente, espontânea, límpida e sem disúria / Por SVD com débito claro e satisfatório].
[Evacuação presente nas últimas 24h, aspecto / Ausente há ___ dias, sem distensão ou dor].

# EXAME FÍSICO:
SSVV:
PA: [ ]x[ ] mmHg (Variação 24h: [ ] a [ ] mmHg) | FC: [ ] bpm | FR: [ ] irpm | SpO2: [ ]% ([em ar ambiente / sob O2 a ___ L/min]).
Curva Térmica (24h): Tax máxima de [ ] °C ([Afebril há > 24–48h / Apresentou pico febril de ___ °C às HH:MM]).
Balanço Hídrico (24h): Diurese total: [ ] mL ([ ] mL/kg/h) | BH fechado: [Neutro / Positivo em + ___ mL / Negativo em - ___ mL].
Curva Glicêmica Capilar (HGT 24h): Jejum: [ ] mg/dL | Pré-almoço: [ ] mg/dL | Pré-jantar: [ ] mg/dL | 22h: [ ] mg/dL.
Geral: [Bom / Regular] estado geral, LOTE (Glasgow 15), corado(a), hidratado(a), anictérico(a), acianótico(a), eupneico(a). TEC < 2 segundos.
AR: Expansibilidade simétrica, murmúrio vesicular [universalmente audível sem ruídos adventícios / com estertores crepitantes em base em regressão / com sibilos esparsos].
ACV: RCR 2T, BNF, sem sopros audíveis. Pulsos periféricos simétricos.
ABD: Plano/globoso, flácido, indolor à palpação superficial e profunda, RHA+, sem visceromegalias ou sinais de irritação peritoneal.
EXT: [Sem edemas / Edema de MMII (+/4+) simétrico]; panturrilhas livres e indolores (Homans negativo). Sítio de punção venosa em [MSD / MSE] limpo, pérvio, sem hiperemia, calor ou cordão flebítico.
Exames Complementares Recentes ([DD/MM]):
Laboratório: Hb: [ ] g/dL | Leucócitos: [ ] /mm³ (Bast: [ ]%) | Plaquetas: [ ] /mm³ | PCR: [ ] mg/L | Cr: [ ] mg/dL | Ur: [ ] mg/dL | Na: [ ] mEq/L | K: [ ] mEq/L.
Microbiologia / Culturas: [Aguardando resultado parcial / Negativas até o momento / Isolamento de ___ sensível a ___].
Imagem / Outros: [Sem novos exames de imagem / RX de tórax: ___ / USG: ___].

# HIPÓTESES DIAGNÓSTICAS:
1. [Problema Principal 1]: [Evoluindo com melhora clínica e queda de / Estável clinicamente, mantida conduta / Descompensação aguda exigindo ajuste terapêutico].
2. [Comorbidades / Equilíbrio Hidroeletrolítico]: [Função renal e eletrólitos estáveis, glicemias / Em correção de: ___].
3. Auditoria de Antimicrobiano & Dispositivos: [Mantido esquema atual em D / Preenchidos critérios de Switch Therapy para / Indicada retirada de SVD/AVP hoje].

# CONDUTA:

>> CONDUTA & METAS DO DIA (ENFERMARIA):
1. Dieta: Manter dieta [geral / para diabetes / hipossódica / branda] por via oral; estimular ingesta hídrica oral.
2. Hidratação Venosa: [Suspensa soroterapia de manutenção; manter / Manter SF 0,9% ___ mL EV em 24h].
3. Terapêutica Antimicrobiana & Específica:
   - [Manter ___ em D ___ de ___ dias / Realizar transição (Switch Therapy) para via / Suspender antibiótico por término de tratamento].
   - [Ajuste de medicações de uso contínuo / controle pressórico e glicêmico: ___].
4. Profilaxia de TEV & Mobilidade: Manter [Enoxaparina 40 mg SC 1x/dia / HNF 5.000 UI SC 8/8h] + estimular deambulação assistida no corredor e fisioterapia motora/respiratória.
5. Revisão de Dispositivos Invasivos: [Retirar Sonda Vesical de Demora hoje / Trocar ou sacar acesso periférico com > 96h / Manter dispositivos atuais pérvios].
6. Exames de Controle Solicitados para [Amanhã / Segunda-feira]: [Hemograma, PCR, Função Renal e Eletrólitos / Sem necessidade de coleta laboratorial amanhã].
7. Planejamento de Alta (Desospitalização): [Previsão de alta hospitalar em (24 / 48) horas após transição oral / Alta hospitalar programada para hoje].
```

---

## 🎯 Diretrizes & Raciocínio Clínico

### 🧠 1. Fisiopatologia & Porquê
**🧠 1. Por Que Auditamos Balanço Hídrico, Curva Térmica e Dispositivos Todo Dia? (Fisiopatologia & Raciocínio)**
- **Por que o Balanço Hídrico e o Peso Diário antecedem o exame físico na congestão e na IRA:** O acúmulo positivo de `> 1,5 a 2 L` de fluidos em 24–48h ocorre no interstício pulmonar e esplâncnico horas antes de surgirem estertores crepitantes audíveis ou edema periférico. Da mesma forma, uma diurese `< 0,5 mL/kg/h` detecta precocemente a hipoperfusão renal (IRA pré-renal) antes da subida da creatinina sérica (que leva 24–48h para elevar-se).
- **Por que todo cateter periférico > 72–96h e toda SVD devem ser questionados diariamente:** O biofilme bacteriano coloniza cateteres venosos e sondas vesicais de forma exponencial com o tempo de permanência. Mais de 80% das infecções urinárias hospitalares são diretamente causadas por sonda vesical esquecida no leito (ITU-AC), e a flebite química/bacteriana em acesso periférico é causa frequente de febre nosocomial evitável.

### 🧭 2. Critérios & Decisão (Internação / Alta / Escores)
**🧭 3. Critérios Objetivos para Switch Therapy (EV → VO) e Investigação de Febre Nosocomial**
| Critério Clínico para Switch Therapy (EV → VO) | Parâmetro de Segurança Obrigatório | Opções Clássicas de Equivalência Terapêutica |
| :--- | :--- | :--- |
| **1. Defervescência Sustentada** | Afebril (`Tax < 37,8 °C`) há pelo menos **24 a 48 horas** | `Ceftriaxona EV` → `Amoxicilina+Clavulanato 875/125 mg VO 12/12h` ou `Cefuroxima 500 mg VO 12/12h` |
| **2. Estabilidade Clínica e Laboratorial** | Melhora da dispneia/dor, `FC < 100 bpm`, `PAS ≥ 100 mmHg`, queda de PCR e leucócitos | `Ampicilina+Sulbactam EV` → `Amoxicilina+Clavulanato 875/125 mg VO 12/12h` |
| **3. Trato Digestivo Funcionante** | Aceitando dieta por via oral sem vômitos, sem íleo paralítico ou síndrome disabsortiva | `Ciprofloxacino 400 mg EV 12/12h` → `Ciprofloxacino 500 mg VO 12/12h` |
| **4. Ausência de Infecção que Exige Nível Sérico EV Estrito** | Excluídas endocardite infecciosa, meningite, abscesso não drenado ou *S. aureus* bacterêmico | `Clindamicina 600 mg EV 8/8h` → `Clindamicina 300 a 600 mg VO 8/8h` |

### 💊 3. Farmacologia & Doses
**💊 2. Por Que e Quando Fazemos o "Switch Therapy" (Transição do Antibiótico EV para VO)?**
- **Por que transicionar precocemente para via oral é mais seguro do que manter antibiótico venoso até o fim:** Antimicrobianos com excelente biodisponibilidade oral (como Amoxicilina+Clavulanato, Cefuroxima, Fluoroquinolonas, Macrolídeos, Clindamicina, Linezolida e Sulfametoxazol+Trimetoprima) atingem concentrações séricas e teciduais equivalentes à via venosa quando o trato gastrointestinal está íntegro, eliminando o risco de flebite, infecção de corrente sanguínea e reduzindo o tempo de internação.

### 🚫 4. Segurança, Travas & Proibições
- Nunca atrasar suporte de emergência diante de sinais de alarme ou instabilidade hemodinâmica; revisar contraindicações absolutas.
