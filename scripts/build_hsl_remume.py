#!/usr/bin/env python3
"""Gera public/data/hsl-guia.json (976 fármacos HSL saneados) e enriquece src/data/remume.ts (252 itens)
com mapeamento REMUME -> HSL via apresentações, normalização e dicionário de sinônimos/sais.
"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
HSL_SOURCE = Path("/home/wagmoraes/Projetos IA/Rotina/src/data/guia_farmaceutico_hsl.json")
REMUME_TS = ROOT / "src" / "data" / "remume.ts"
HSL_OUT = ROOT / "public" / "data" / "hsl-guia.json"

HSL_FIELDS = (
    "id",
    "farmaco",
    "nome_normalizado",
    "na_remume",
    "apresentacoes_remume",
    "apresentacoes_hsl",
    "indicacoes",
    "dose_adulto",
    "dose_pediatria",
    "dose_maxima",
    "ajuste_dose",
    "administracao",
    "preparo_diluicao",
    "contraindicacoes",
    "gestacao_lactacao",
)

# Dicionário explícito de sinônimos, sais e associações (chave: prefixo normalizado REMUME -> id HSL)
REMUME_TO_HSL_SYNONYMS: dict[str, int] = {
    "adrenalina": 162,  # EPINEFRINA
    "amoxicilina+clavulanato": 49,  # AMOXICILINA (A) + CLAVULANATO DE POTÁSSIO (B)
    "atropina": 62,  # ATROPINA
    "carvedilol": 406,  # CARVEDILOL
    "carvao ativado": 405,  # CARVÃO VEGETAL ATIVADO
    "ciprofloxacina": 475,  # CIPROFLOXACINO
    "ciproterona, acetato": 483,  # CIPROTERONA
    "clonazepam": 523,  # CLONAZEPAM
    "clonidina": 524,  # CLONIDINA
    "deslanosideo": 129,  # DESLANOSIDEO
    "dextrocetamina": 421,  # ESCETAMINA
    "digoxina": 148,  # DIGOXINA
    "dimeticona": 636,  # SIMETICONA
    "dobutamina": 710,  # DOBUTAMINA
    "flumazenil": 209,  # FLUMAZENIL
    "gliclazida": 254,  # GLICLAZIDA MR
    "hioscina + dipirona": 174,  # ESCOPOLAMINA (A) + DIPIRONA SÓDICA (B)
    "hioscina": 173,  # ESCOPOLAMINA
    "insulina humana nph": 678,  # INSULINA HUMANA RECOMBINANTE (NPH)
    "levonorgestrel": 323,  # LEVONORGESTREL
    "lopinavir + ritonavir": 337,  # LOPINAVIR (A) + RITONAVIR (B)
    "metilergometrina": 368,  # METILERGOMETRINA
    "midazolam": 701,  # MIDAZOLAM (INJETÁVEL)
    "naloxona": 449,  # NALOXONA
    "neomicina 5 mg/g + bacitracina": 454,  # NEOMICINA (A) + BACITRACINA (B)
    "sulfato ferroso": 196,  # FERRO (ORAL)
    "terbutalina sulfato": 734,  # TERBUTALINA
    "zidovudina + lamivudina": 315,  # LAMIVUDINA (A) + ZIDOVUDINA (B)
    "acido folico": 14,  # ÁCIDO FÓLICO
    "acido valproico": 774,  # VALPROATO DE SÓDIO
}

SUPERSCRIPT_RE = re.compile(
    r"(?<![mMdDcCkK0-9])(?:[⁰¹²³⁴⁵⁶⁷⁸⁹]+(?:\s*[,–\-]\s*[⁰¹²³⁴⁵⁶⁷⁸⁹]+)*)"
)
SECTION_HEADER_RE = re.compile(
    r"(?im)^(Pediatria|Pediátrico|Dose\s+m[áa]xima(?:\s+Adultos?)?|Ajuste\s+de\s+dose)\b\s*:?\s*"
)


def strip_accents_lower(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text)
    no_acc = "".join(ch for ch in nfkd if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", no_acc.lower().strip())


def clean_superscripts(text: str) -> str:
    if not text:
        return ""
    cleaned = SUPERSCRIPT_RE.sub("", text)
    # Limpa espaços extras antes de pontuação ou fim de linha, preservando quebras de linha
    lines = [re.sub(r"[ \t]{2,}", " ", ln).rstrip() for ln in cleaned.splitlines()]
    return "\n".join(lines).strip()


def split_embedded_sections(
    dose_adulto: str,
    dose_pediatria: str,
    dose_maxima: str,
    ajuste_dose: str,
) -> tuple[str, str, str, str]:
    """Separa seções Pediatria / Dose máxima / Ajuste de dose embutidas em dose_adulto."""
    if not dose_adulto:
        return dose_adulto, dose_pediatria, dose_maxima, ajuste_dose

    matches = list(SECTION_HEADER_RE.finditer(dose_adulto))
    if not matches:
        return dose_adulto, dose_pediatria, dose_maxima, ajuste_dose

    adult_part = dose_adulto[: matches[0].start()].strip()
    adult_part = re.sub(r"(?im)^Adultos?\s*:?\s*", "", adult_part).strip()

    for idx, match in enumerate(matches):
        header = strip_accents_lower(match.group(1))
        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(dose_adulto)
        body = dose_adulto[start:end].strip()
        if not body:
            continue
        if header.startswith("pediatr") and not dose_pediatria:
            dose_pediatria = body
        elif header.startswith("dose maxima") and not dose_maxima:
            dose_maxima = body
        elif header.startswith("ajuste de dose") and not ajuste_dose:
            ajuste_dose = body

    return adult_part, dose_pediatria, dose_maxima, ajuste_dose


def load_remume_items() -> list[dict[str, Any]]:
    content = REMUME_TS.read_text(encoding="utf-8")
    match = re.search(
        r"export const REMUME_ITEMS:\s*RemumeItem\[\]\s*=\s*(\[.*\]);",
        content,
        re.S,
    )
    if not match:
        raise RuntimeError("Não foi possível localizar REMUME_ITEMS em src/data/remume.ts")
    return json.loads(match.group(1))


def sanitize_hsl_records(raw_meds: list[dict[str, Any]]) -> list[dict[str, Any]]:
    sanitized: list[dict[str, Any]] = []
    for raw in raw_meds:
        farmaco = clean_superscripts(str(raw.get("farmaco") or raw.get("farnaco") or ""))
        nome_norm = clean_superscripts(str(raw.get("nome_normalizado") or farmaco))
        dose_adulto = clean_superscripts(str(raw.get("dose_adulto") or ""))
        dose_pediatria = clean_superscripts(str(raw.get("dose_pediatria") or ""))
        dose_maxima = clean_superscripts(str(raw.get("dose_maxima") or ""))
        ajuste_dose = clean_superscripts(str(raw.get("ajuste_dose") or ""))

        dose_adulto, dose_pediatria, dose_maxima, ajuste_dose = split_embedded_sections(
            dose_adulto, dose_pediatria, dose_maxima, ajuste_dose
        )

        record: dict[str, Any] = {
            "id": int(raw["id"]),
            "farmaco": farmaco,
            "nome_normalizado": nome_norm,
            "na_remume": bool(raw.get("na_remume", False)),
            "apresentacoes_remume": [
                clean_superscripts(str(x)) for x in (raw.get("apresentacoes_remume") or [])
            ],
            "apresentacoes_hsl": [
                clean_superscripts(str(x)) for x in (raw.get("apresentacoes_hsl") or [])
            ],
            "indicacoes": clean_superscripts(str(raw.get("indicacoes") or "")),
            "dose_adulto": dose_adulto,
            "dose_pediatria": dose_pediatria,
            "dose_maxima": dose_maxima,
            "ajuste_dose": ajuste_dose,
            "administracao": clean_superscripts(str(raw.get("administracao") or "")),
            "preparo_diluicao": clean_superscripts(str(raw.get("preparo_diluicao") or "")),
            "contraindicacoes": clean_superscripts(str(raw.get("contraindicacoes") or "")),
            "gestacao_lactacao": clean_superscripts(str(raw.get("gestacao_lactacao") or "")),
        }
        sanitized.append(record)
    return sanitized


def match_remume_to_hsl(
    remume_items: list[dict[str, Any]],
    hsl_records: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    by_id: dict[int, dict[str, Any]] = {rec["id"]: rec for rec in hsl_records}
    by_apresentacao: dict[str, dict[str, Any]] = {}
    by_norm_name: dict[str, dict[str, Any]] = {}

    for rec in hsl_records:
        for ap in rec["apresentacoes_remume"]:
            by_apresentacao[ap] = rec
        norm_key = strip_accents_lower(rec["nome_normalizado"] or rec["farmaco"])
        by_norm_name.setdefault(norm_key, rec)

    enriched_remume: list[dict[str, Any]] = []
    matched_count = 0

    for item in remume_items:
        name = str(item["name"])
        norm = strip_accents_lower(str(item.get("norm") or name))
        hsl_match: dict[str, Any] | None = by_apresentacao.get(name)

        if hsl_match is None:
            # Tenta match exato pelo nome base antes de concentração/forma
            base = re.split(r"\s+\d|\s+\(", norm)[0].strip()
            if base in by_norm_name:
                hsl_match = by_norm_name[base]
            else:
                # Ordena chaves mais específicas primeiro para evitar colisão parcial
                for syn_key, hsl_id in sorted(
                    REMUME_TO_HSL_SYNONYMS.items(), key=lambda kv: len(kv[0]), reverse=True
                ):
                    if norm.startswith(syn_key):
                        hsl_match = by_id.get(hsl_id)
                        break

        entry: dict[str, Any] = {"name": name, "norm": norm}
        if hsl_match is not None:
            matched_count += 1
            entry["hslId"] = hsl_match["id"]
            entry["hslFarmaco"] = hsl_match["farmaco"]
            hsl_match["na_remume"] = True
            if name not in hsl_match["apresentacoes_remume"]:
                hsl_match["apresentacoes_remume"].append(name)

        enriched_remume.append(entry)

    return enriched_remume, matched_count


def write_remume_ts(enriched_remume: list[dict[str, Any]], matched_count: int) -> None:
    total = len(enriched_remume)
    pct = (matched_count / total * 100.0) if total else 0.0
    payload = json.dumps(enriched_remume, ensure_ascii=False, indent=2)
    header = (
        "// ============================================================================\n"
        f"// REMUME (Ribeirão Preto) — Lista Padronizada de Medicamentos ({total} itens)\n"
        f"// Mapeamento REMUME -> Guia HSL: {matched_count}/{total} ({pct:.1f}%) vinculados.\n"
        "// Gerado por scripts/build_hsl_remume.py — manter compatibilidade com RemumeItem.\n"
        "// ============================================================================\n\n"
        "export interface RemumeItem {\n"
        "  name: string;\n"
        "  norm: string;\n"
        "  hslId?: number;\n"
        "  hslFarmaco?: string;\n"
        "}\n\n"
        f"export const REMUME_ITEMS: RemumeItem[] = {payload};\n"
    )
    REMUME_TS.write_text(header, encoding="utf-8")


def main() -> None:
    raw_hsl = json.loads(HSL_SOURCE.read_text(encoding="utf-8"))
    raw_meds = raw_hsl.get("medicamentos", [])
    hsl_records = sanitize_hsl_records(raw_meds)
    remume_items = load_remume_items()

    enriched_remume, matched_count = match_remume_to_hsl(remume_items, hsl_records)

    HSL_OUT.parent.mkdir(parents=True, exist_ok=True)
    hsl_payload = {
        "metadados": {
            "fonte": raw_hsl.get("metadados", {}).get(
                "fonte", "Guia Farmacêutico Hospital Sírio-Libanês (HSL)"
            ),
            "url_oficial": raw_hsl.get("metadados", {}).get(
                "url_oficial", "https://guiafarmaceutico.hsl.org.br"
            ),
            "total_medicamentos": len(hsl_records),
            "total_na_remume_hsl": sum(1 for r in hsl_records if r["na_remume"]),
            "total_remume_vinculados": matched_count,
            "total_remume_itens": len(enriched_remume),
        },
        "medicamentos": hsl_records,
    }
    HSL_OUT.write_text(
        json.dumps(hsl_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    write_remume_ts(enriched_remume, matched_count)

    pct = (matched_count / len(enriched_remume) * 100.0) if enriched_remume else 0.0
    print(
        f"OK: {len(hsl_records)} fármacos HSL em {HSL_OUT.relative_to(ROOT)} | "
        f"REMUME->HSL: {matched_count}/{len(enriched_remume)} ({pct:.1f}%)"
    )


if __name__ == "__main__":
    main()
