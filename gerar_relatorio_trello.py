#!/usr/bin/env python3
"""
MetricFlow — Gerador Automático de Relatório Trello (Cards em Atraso)
======================================================================
Uso:
    python gerar_relatorio_trello.py

Pré-requisitos:
    pip install requests reportlab python-dotenv

Variáveis necessárias no .env (na raiz do metric-flow):
    TRELLO_API_KEY
    TRELLO_TOKEN
    TRELLO_BOARDS      (JSON array com revenda + boardId)
    TRELLO_REPORT_OUTPUT_PATH   (pasta onde salvar o PDF)
"""

import os
import json
import sys
import base64
import requests
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

# ── Carrega .env ──────────────────────────────────────────────────────────────
# Sobe dois níveis caso seja chamado de fora da pasta metric-flow
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

API_KEY   = os.getenv("TRELLO_API_KEY", "")
TOKEN     = os.getenv("TRELLO_TOKEN", "")
BOARDS    = json.loads(os.getenv("TRELLO_BOARDS", "[]"))
OUT_DIR   = Path(os.getenv("TRELLO_REPORT_OUTPUT_PATH", str(Path.home() / "Documents" / "relatorios" / "trello")))

if not API_KEY or not TOKEN:
    print("❌  TRELLO_API_KEY e TRELLO_TOKEN não configurados no .env")
    sys.exit(1)

if not BOARDS:
    print("❌  TRELLO_BOARDS não configurado ou vazio no .env")
    sys.exit(1)

OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Trello API ────────────────────────────────────────────────────────────────

BASE = "https://api.trello.com/1"

def trello_get(path: str, **params) -> dict | list:
    url = f"{BASE}{path}"
    params.update({"key": API_KEY, "token": TOKEN})
    r = requests.get(url, params=params, timeout=15)
    r.raise_for_status()
    return r.json()


def get_overdue_cards(board_id: str) -> dict:
    """Retorna dict com cards em atraso, listas e membros do board."""
    now = datetime.now(timezone.utc)

    try:
        cards   = trello_get(f"/boards/{board_id}/cards",
                             filter="open",
                             fields="id,name,due,dueComplete,labels,idMembers,idList,shortUrl,desc")
        lists   = trello_get(f"/boards/{board_id}/lists", fields="id,name")
        members = trello_get(f"/boards/{board_id}/members", fields="id,fullName,username")
    except requests.HTTPError as e:
        return {"erro": str(e), "cards": []}

    list_map   = {l["id"]: l["name"] for l in lists}
    member_map = {m["id"]: m.get("fullName") or m.get("username", m["id"]) for m in members}

    overdue = []
    for c in cards:
        if not c.get("due") or c.get("dueComplete"):
            continue
        due_dt = datetime.fromisoformat(c["due"].replace("Z", "+00:00"))
        if due_dt >= now:
            continue
        dias = (now - due_dt).days
        overdue.append({
            "id":        c["id"],
            "nome":      c["name"],
            "due":       due_dt.strftime("%d/%m/%Y"),
            "diasAtraso": dias,
            "lista":     list_map.get(c["idList"], "—"),
            "membros":   [member_map.get(mid, mid) for mid in c.get("idMembers", [])],
            "etiquetas": [{"nome": lb.get("name",""), "cor": lb.get("color","")} for lb in c.get("labels", [])],
            "url":       c.get("shortUrl", ""),
            "descricao": c.get("desc", ""),
        })

    overdue.sort(key=lambda x: -x["diasAtraso"])
    return {"cards": overdue, "erro": None}


# ── PDF com ReportLab ─────────────────────────────────────────────────────────

def gerar_pdf(dados: list[dict], output_path: Path):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer,
                                    Table, TableStyle, HRFlowable, PageBreak)
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

    W, H = A4
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm,
        title="Relatório Trello — Cards em Atraso",
    )

    styles = getSampleStyleSheet()
    title_style   = ParagraphStyle("titulo",   parent=styles["Title"],  fontSize=18, spaceAfter=4, textColor=colors.HexColor("#1e293b"))
    sub_style     = ParagraphStyle("sub",      parent=styles["Normal"], fontSize=9,  textColor=colors.HexColor("#64748b"), spaceAfter=12)
    h2_style      = ParagraphStyle("h2",       parent=styles["Normal"], fontSize=12, fontName="Helvetica-Bold", textColor=colors.HexColor("#334155"), spaceBefore=8, spaceAfter=4)
    normal_style  = ParagraphStyle("normal",   parent=styles["Normal"], fontSize=8,  textColor=colors.HexColor("#475569"), spaceAfter=2)
    badge_ok      = ParagraphStyle("ok",       parent=styles["Normal"], fontSize=8,  textColor=colors.HexColor("#16a34a"))
    badge_erro    = ParagraphStyle("erro",     parent=styles["Normal"], fontSize=8,  textColor=colors.HexColor("#dc2626"))
    card_name_s   = ParagraphStyle("cardnm",   parent=styles["Normal"], fontSize=9,  fontName="Helvetica-Bold", textColor=colors.HexColor("#1e293b"))
    meta_style    = ParagraphStyle("meta",     parent=styles["Normal"], fontSize=7.5,textColor=colors.HexColor("#64748b"))

    data_gerado = datetime.now().strftime("%d/%m/%Y %H:%M")
    total_atraso = sum(len(r.get("cards", [])) for r in dados)

    story = []

    # Cabeçalho
    story.append(Paragraph("Relatório — Cards em Atraso no Trello", title_style))
    story.append(Paragraph(f"Gerado em: {data_gerado}   |   Total de cards em atraso: <b>{total_atraso}</b>", sub_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0"), spaceAfter=10))

    def urgency_color(dias: int) -> str:
        if dias >= 14: return "#ef4444"
        if dias >= 7:  return "#f97316"
        return "#eab308"

    for revenda_data in dados:
        revenda = revenda_data["revenda"]
        cards   = revenda_data.get("cards", [])
        erro    = revenda_data.get("erro")

        story.append(Spacer(1, 4))

        # Header revenda
        qtd_txt = f"{'⚠ Erro' if erro else ('✓ Em dia' if not cards else f'{len(cards)} em atraso')}"
        header_data = [[
            Paragraph(f"<b>{revenda}</b>", h2_style),
            Paragraph(qtd_txt, badge_erro if (erro or cards) else badge_ok),
        ]]
        header_tbl = Table(header_data, colWidths=[120*mm, 40*mm])
        header_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#f1f5f9")),
            ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.HexColor("#f1f5f9")]),
            ("LEFTPADDING", (0,0), (-1,-1), 8),
            ("RIGHTPADDING", (0,0), (-1,-1), 8),
            ("TOPPADDING", (0,0), (-1,-1), 6),
            ("BOTTOMPADDING", (0,0), (-1,-1), 6),
            ("ROUNDEDCORNERS", [4]),
            ("ALIGN", (1,0), (1,-1), "RIGHT"),
        ]))
        story.append(header_tbl)
        story.append(Spacer(1, 4))

        if erro:
            story.append(Paragraph(f"Erro ao carregar board: {erro}", badge_erro))
            continue

        if not cards:
            story.append(Paragraph("Nenhum card em atraso. Revenda em dia!", badge_ok))
            continue

        # Tabela de cards
        col_widths = [75*mm, 20*mm, 20*mm, 30*mm, 25*mm]
        table_data = [[
            Paragraph("<b>Card</b>", meta_style),
            Paragraph("<b>Prazo</b>", meta_style),
            Paragraph("<b>Atraso</b>", meta_style),
            Paragraph("<b>Lista</b>", meta_style),
            Paragraph("<b>Responsáveis</b>", meta_style),
        ]]

        row_colors = []
        for i, card in enumerate(cards):
            bg = colors.white if i % 2 == 0 else colors.HexColor("#f8fafc")
            row_colors.append(bg)
            dias_color = urgency_color(card["diasAtraso"])
            table_data.append([
                Paragraph(card["nome"], card_name_s),
                Paragraph(card["due"], meta_style),
                Paragraph(f'<font color="{dias_color}"><b>{card["diasAtraso"]}d</b></font>', meta_style),
                Paragraph(card["lista"], meta_style),
                Paragraph(", ".join(card["membros"]) or "—", meta_style),
            ])

        tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
        tbl_style = [
            ("BACKGROUND",   (0,0), (-1,0),  colors.HexColor("#e2e8f0")),
            ("GRID",         (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
            ("LEFTPADDING",  (0,0), (-1,-1), 5),
            ("RIGHTPADDING", (0,0), (-1,-1), 5),
            ("TOPPADDING",   (0,0), (-1,-1), 4),
            ("BOTTOMPADDING",(0,0), (-1,-1), 4),
            ("VALIGN",       (0,0), (-1,-1), "TOP"),
        ]
        for i, bg in enumerate(row_colors):
            tbl_style.append(("BACKGROUND", (0, i+1), (-1, i+1), bg))

        tbl.setStyle(TableStyle(tbl_style))
        story.append(tbl)
        story.append(Spacer(1, 6))

    # Rodapé
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0")))
    story.append(Paragraph(
        f"MetricFlow — Gerado automaticamente em {data_gerado} — Dados via Trello API",
        ParagraphStyle("footer", parent=styles["Normal"], fontSize=7, textColor=colors.HexColor("#94a3b8"), alignment=TA_CENTER)
    ))

    doc.build(story)


# ── Evolution API — Envio WhatsApp ───────────────────────────────────────────

EVOLUTION_URL      = os.getenv("EVOLUTION_API_URL", "http://localhost:8080")
EVOLUTION_KEY      = os.getenv("EVOLUTION_API_KEY", "")
EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE", "metricflow")
ENVIAR_SEMPRE      = os.getenv("WHATSAPP_ENVIAR_SEMPRE", "false").lower() == "true"


def _evolution_headers() -> dict:
    return {"apikey": EVOLUTION_KEY, "Content-Type": "application/json"}


def whatsapp_enviar_texto(numero: str, texto: str) -> bool:
    """Envia mensagem de texto pelo WhatsApp via Evolution API."""
    url = f"{EVOLUTION_URL}/message/sendText/{EVOLUTION_INSTANCE}"
    payload = {"number": numero, "text": texto}
    try:
        r = requests.post(url, json=payload, headers=_evolution_headers(), timeout=15)
        r.raise_for_status()
        return True
    except Exception as e:
        print(f"      ⚠  Erro ao enviar texto para {numero}: {e}")
        return False


def whatsapp_enviar_pdf(numero: str, caminho_pdf: Path, caption: str = "") -> bool:
    """Envia PDF como documento pelo WhatsApp via Evolution API."""
    url = f"{EVOLUTION_URL}/message/sendMedia/{EVOLUTION_INSTANCE}"
    try:
        with open(caminho_pdf, "rb") as f:
            pdf_b64 = base64.b64encode(f.read()).decode()
        payload = {
            "number": numero,
            "mediatype": "document",
            "mimetype": "application/pdf",
            "caption": caption,
            "media": pdf_b64,
            "fileName": caminho_pdf.name,
        }
        r = requests.post(url, json=payload, headers=_evolution_headers(), timeout=30)
        r.raise_for_status()
        return True
    except Exception as e:
        print(f"      ⚠  Erro ao enviar PDF para {numero}: {e}")
        return False


def montar_mensagem(resultados: list, total: int, data_str: str) -> str:
    """Monta o texto de resumo para o WhatsApp."""
    linhas = [
        "📋 *Relatório Trello — Cards em Atraso*",
        f"🕐 {data_str}",
        "─────────────────────",
    ]
    for r in resultados:
        n = len(r.get("cards", []))
        if r.get("erro"):
            linhas.append(f"⚠️ *{r['revenda']}:* erro ao carregar")
        elif n == 0:
            linhas.append(f"✅ *{r['revenda']}:* em dia")
        else:
            # Lista os 3 cards mais atrasados
            linhas.append(f"🔴 *{r['revenda']}:* {n} em atraso")
            for card in r["cards"][:3]:
                linhas.append(f"   • {card['nome']} ({card['diasAtraso']}d)")
            if n > 3:
                linhas.append(f"   _...e mais {n - 3} card(s)_")
    linhas += [
        "─────────────────────",
        f"📊 *Total: {total} cards em atraso*",
        "_(relatório PDF em anexo)_",
    ]
    return "\n".join(linhas)


def enviar_whatsapp(resultados: list, total: int, caminho_pdf: Path):
    """Envia mensagem + PDF para todos os destinatários configurados."""
    if not EVOLUTION_KEY:
        print("⚠  EVOLUTION_API_KEY não configurado — envio WhatsApp ignorado.")
        return

    destinatarios_raw = os.getenv("WHATSAPP_DESTINATARIOS", "")
    destinatarios = [d.strip() for d in destinatarios_raw.split(",") if d.strip()]
    if not destinatarios:
        print("⚠  WHATSAPP_DESTINATARIOS não configurado — envio ignorado.")
        return

    if total == 0 and not ENVIAR_SEMPRE:
        print("✅  Nenhum atraso — WhatsApp não enviado (WHATSAPP_ENVIAR_SEMPRE=false).")
        return

    data_str  = datetime.now().strftime("%d/%m/%Y %H:%M")
    mensagem  = montar_mensagem(resultados, total, data_str)

    print(f"\n📲  Enviando WhatsApp para {len(destinatarios)} destinatário(s)...")
    for numero in destinatarios:
        print(f"   → {numero}", end=" ", flush=True)
        ok_txt = whatsapp_enviar_texto(numero, mensagem)
        ok_pdf = whatsapp_enviar_pdf(numero, caminho_pdf)
        print("✅" if ok_txt and ok_pdf else "⚠ parcial")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"🔄  Buscando cards em atraso de {len(BOARDS)} revendas...")

    resultados = []
    for board in BOARDS:
        revenda  = board["revenda"]
        board_id = board["boardId"]
        print(f"   → {revenda} (board: {board_id[:8]}...)", end=" ", flush=True)
        resultado = get_overdue_cards(board_id)
        resultado["revenda"] = revenda
        resultado["boardId"] = board_id
        n = len(resultado.get("cards", []))
        if resultado.get("erro"):
            print(f"❌  {resultado['erro']}")
        else:
            print(f"{'✓' if n == 0 else '⚠'} {n} em atraso")
        resultados.append(resultado)

    total = sum(len(r.get("cards", [])) for r in resultados)
    print(f"\n📊  Total: {total} cards em atraso")

    # Nome do arquivo com data/hora
    ts   = datetime.now().strftime("%Y%m%d_%H%M")
    nome = f"relatorio_trello_{ts}.pdf"
    path = OUT_DIR / nome

    print(f"📄  Gerando PDF: {path} ...")
    gerar_pdf(resultados, path)
    print(f"✅  Relatório salvo em: {path}")

    # Envia via WhatsApp
    enviar_whatsapp(resultados, total, path)

    # Manter apenas os 30 PDFs mais recentes
    pdfs = sorted(OUT_DIR.glob("relatorio_trello_*.pdf"), key=os.path.getmtime)
    while len(pdfs) > 30:
        pdfs.pop(0).unlink()


if __name__ == "__main__":
    main()
