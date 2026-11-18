# Script de Passagem de Caso / Round de Puerpério
**Categoria:** Enfermaria Puerperio  
**Atalho:** `;round-puerp`  
**Gravidade:** Enfermaria / Internação  
**CID-10:** Z39.0  

---

## 📋 Snippet para Prontuário Eletrônico (PEP)

```text
# HISTÓRIA / RESUMO DA INTERNAÇÃO:
[ ]
[DD/MM/AAAA] | Evolução prévia até ontem: [ ]

# IDENTIFICAÇÃO:
ID: [Nome], [Idade] anos, Sexo: [Masculino / Feminino], Leito: [ ].

# 1. MANCHETE OBSTÉTRICA (IDENTIFICAÇÃO + PARTO + RISCO):
"Preceptor(a), Leito [ ],[Nome], [Idade] anos, G [ ] P [ ], no [1º / 2º / 3º] DPO de [Parto Normal sem intercorrências / Parto Normal com laceração de 2º grau / Cesariana por indicação] com IG de [ ]s[ ]d.
- Antecedentes: [Hígida / HAG / Pré-eclâmpsia / DMG em dieta / Anemia / Outros] | Alergias: [*Nega alergias / Alérgica (especificar)].
- Intraparto: [Sem intercorrências / Apresentou HPP por atonia revertida]."

# 2. EVOLUÇÃO (24H) & AMAMENTAÇÃO:
"Passou as últimas 24h estável, afebril, deambulando sem ortostatismo e aceitando bem a dieta.
- Dor & Eliminações: Dor [ausente / leve controlada com dipirona], diurese espontânea clara, flatos presentes, evacuação [presente / ausente] e lóquios fisiológicos sem odor. Nega cefaleia, escotomas, epigastralgia ou dispneia.
- Amamentação: RN em AME sob livre demanda, com [boa pega, posicionamento adequado e papilas íntegras / ajuste de pega realizado]."

# 3. EXAME FÍSICO DIRIGIDO:
"Ao exame físico hoje:
- Vitais: PA [ ] mmHg | FC [ ] bpm | FR [ ] irpm | Tax [ ] °C | Corada e hidratada.
- Mamas: [Túrgidas fisiológicas / Flácidas], sem mastite ou fissuras, colostro presente bilateralmente.
- Abdome & Útero: Flácido, sem bexigoma, útero contraído (Globo de Pinard presente) a [ ] cm abaixo da cicatriz umbilical, indolor.
- Períneo / FO: [Períneo íntegro / Rafia perineal coaptada e limpa / FO de Pfannenstiel limpa, seca e sem flogose], lóquios rubros fisiológicos.
- Extremidades: Sem edemas assimétricos, panturrilhas livres e indolores."

# 4. AUDITORIA DE PRONTUÁRIO (DADOS MANDATÓRIOS DA CHEFIA):
"- Imuno-hematologia: Mãe TS [O+ / A+ / B+ / AB+ / O- / A- / B- / AB-], RN TS [O+ / A+ / B+ / AB+ / O- / A- / B- / AB-], Coombs Direto [*negativo / positivo].
- Sorologias & Vacinas: HIV, VDRL e HBsAg [não reagentes / Outros], Toxo [imune / suscetível orientada].
- Controles Específicos: [Curva pressórica normotensa < 140x90 mmHg / Glicemias capilares normais sem insulina / Hb de controle pós-HPP: g/dL]."

# CONDUTA:
1. Risco de TEV: [Baixo -> manter deambulação precoce / Alto -> manter Enoxaparina 40 mg SC/dia por 10–15 dias].
2. Analgesia & Suporte: Manter Dipirona 1 g 6/6h SOS [sem AINEs por ser hipertensa / + Ibuprofeno 600 mg 8/8h] + Sulfato Ferroso 40 mg Fe elementar/dia.
3. Planejamento Reprodutivo: [Ponte c/ Desogestrel 75 mcg/dia / Encaminhada à UBS para inserção de Implanon / Inserido Implanon antes da alta / Encaminhada à UBS para inserção de DIU / Inserido DIU de Cobre pós-placentário / Medroxiprogesterona 150 mg IM trimestral / Laqueadura tubária realizada / Preservativo / Outros].
4. Desfecho Proposto: [Em condições de alta hoje com receita e retorno UBS 7d / Manter internada por mais 24h para vigilância]."
```

---

## 🎯 Diretrizes & Raciocínio Clínico

### 🧠 1. Fisiopatologia & Porquê
**🧠 1. Por Que Estruturamos o Round em 5 Tempos? (Método SNAPPS Obstétrico)**
- **A Psicologia Cognitiva do Preceptor no Round:** Na visita de enfermaria com 15 a 30 leitos, o preceptor precisa construir uma imagem mental imediata de **gravidade e pendências de alta**. Quando você abre o caso com a **Manchete Obstétrica completa** (*Idade, G/P/A, DPO, Via de Parto + Indicação, IG e Comorbidades*), o preceptor já sabe em 5 segundos se está ouvindo uma puérpera de baixo risco pronta para alta ou uma pré-eclâmpsia grave que exige vigilância pressórica.
- **Por que nunca terminar perguntando *"O que fazemos com ela?"*:** O interno de excelência sempre encerra no **Tempo 5 (Plano Proposto)** amarrando os **3 pilares da enfermaria puerperal**: (1) Profilaxia de TEV e Analgesia segura; (2) Contracepção pós-parto já alinhada; e (3) Status objetivo de alta (ou qual pendência exata impede a alta hoje).

### 🧭 2. Critérios & Decisão (Internação / Alta / Escores)
**🧭 2. As 3 Perguntas Clássicas da Chefia (E o Raciocínio por Trás Delas)**
1. ***"Qual a tipagem da mãe, do RN e o Coombs? Já tomou o Matergam (Anti-D)?"***
   - **Por quê:** Durante o descolamento placentário há hemorragia feto-materna. Se a mãe é `Rh negativo` e o RN é `Rh positivo`, a **Imunoglobulina Anti-D 300 mcg IM** precisa neutralizar até 30 mL de sangue fetal **dentro de 72 horas** antes que o sistema imune materno produza IgG anti-D definitiva (que atravessaria a placenta na gestação seguinte causando eritroblastose/hidropisia fetal).
2. ***"Ela teve Pré-Eclâmpsia ou HAG? Você tirou o Cetoprofeno/Ibuprofeno da prescrição?"***
   - **Por quê:** O pico de pressão arterial no puerpério ocorre entre o **3º e o 6º DPO** (quando o edema intersticial acumulado na gravidez é reabsorvido para o espaço intravascular). AINEs bloqueiam a natriurese mediada por prostaglandinas renais e são a principal causa iatrogênica de crise hipertensiva pós-parto.
3. ***"Como estão o Globo de Pinard, os lóquios e a pega da mamada?"***
   - **Por quê:** São os três marcadores clínicos que excluem as três maiores causas de reinternação puerperal: **Hemorragia tardia**, **Endometrite puerperal** e **Mastite/Desmame precoce por fissura mamilar**.

### 💊 3. Farmacologia & Doses
- Conferir doses, vias, diluições, alergias, função renal/hepática e teto posológico antes de assinar a prescrição.

### 🚫 4. Segurança, Travas & Proibições
- Nunca atrasar suporte de emergência diante de sinais de alarme ou instabilidade hemodinâmica; revisar contraindicações absolutas.
