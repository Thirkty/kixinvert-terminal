import os
import re
from typing import Dict, Any, List, Optional
from services.portfolio_service import compute_tactical_shares_to_sell


HUMAN_COMPANY_NAMES = {
    "ABC.A": "Bancaribe (Clase A)",
    "ABC.B": "Bancaribe (Clase B)",
    "RST": "Ron Santa Teresa",
    "RST.B": "Ron Santa Teresa B",
    "EFE": "Productos EFE",
    "BNC": "Banco Nacional de Crédito",
    "BPV": "Banco Provincial",
    "BVL": "Banco de Venezuela",
    "MVZ.A": "Mercantil (Clase A)",
    "MVZ.B": "Mercantil (Clase B)",
    "TPG": "Telares de Palo Grande",
    "PGR": "Proagro",
    "FNV": "Fábrica Nacional de Vidrios",
    "TDV.D": "CANTV",
    "BVCC": "Bolsa de Caracas",
    "CCR": "Cerámica Carabobo",
    "CRM.A": "Corimon",
    "DOM": "Domínguez & Cía",
    "ENV": "Envases Venezolanos",
    "FNC": "Fábrica Nacional de Cementos",
    "IVC.A": "Inversiones Crecepymes A",
    "IVC.B": "Inversiones Crecepymes B",
    "MPA": "MANPA",
    "PCP.B": "Fondo de Valores Inmobiliarios",
    "PTN": "Protinal",
    "SVS": "Sivensa",
    "CGQ": "Corporación Grupo Químico",
}

ALIAS_TO_TICKER = {
    "santa teresa b": "RST.B",
    "santa teresa": "RST",
    "bancaribe": "ABC.A",
    "caribe": "ABC.A",
    "productos efe": "EFE",
    "efe": "EFE",
    "telares": "TPG",
    "palo grande": "TPG",
    "proagro": "PGR",
    "favianca": "FNV",
    "vidrios": "FNV",
    "cantv": "TDV.D",
    "provincial": "BPV",
    "mercantil": "MVZ.A",
    "bolsa de caracas": "BVCC",
}


def human_name(ticker: str, raw_name: str = "") -> str:
    """Returns a natural, human-friendly company name instead of raw uppercase DB strings."""
    t_up = (ticker or "").upper().strip()
    if t_up in HUMAN_COMPANY_NAMES:
        return HUMAN_COMPANY_NAMES[t_up]
    if not raw_name:
        return t_up
    cleaned = raw_name.replace(",C.A.BCO.UNIV.", " ").replace("C.A.", "").strip()
    return cleaned.title()


def clean_ai_text(text: str) -> str:
    """
    Removes all markdown asterisks (** and *) so raw asterisks never clutter
    the chat UI, keeping the response clean and human-readable.
    """
    if not text:
        return ""
    cleaned = re.sub(r"\*+", "", text)
    return cleaned.strip()


def format_currency_ves(amount: float) -> str:
    """Format e.g. 22040.18 -> Bs. 22.040,18"""
    try:
        parts = f"{float(amount):,.2f}".split(".")
        integer_part = parts[0].replace(",", ".")
        decimal_part = parts[1]
        return f"Bs. {integer_part},{decimal_part}"
    except Exception:
        return f"Bs. {amount}"


def _format_shares(count: float) -> str:
    """Format share count cleanly as integer when whole, with 'acción' or 'acciones'."""
    sh_int = int(round(float(count or 0)))
    word = "acción" if sh_int == 1 else "acciones"
    return f"{sh_int:,}".replace(",", ".") + f" {word}"


def extract_user_trade_mentions(question: str, positions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Detects when a user mentions specific quantities and stocks in their message,
    e.g., 'Vendi 1 de ABC.A y 3 de RST.B' or 'si vendo 2 de rst y 1 de efe'.
    Returns a list of matched items with {'position': pos, 'shares': qty}.
    """
    q_clean = question.strip()
    pos_by_ticker = {p.get("ticker", "").upper(): p for p in positions}

    # Build regex of known tickers from user positions + standard BVC tickers
    known_tickers = sorted(
        list(set(list(pos_by_ticker.keys()) + list(HUMAN_COMPANY_NAMES.keys()))),
        key=len,
        reverse=True
    )
    ticker_pattern = "|".join(re.escape(t) for t in known_tickers if t)
    alias_pattern = "|".join(re.escape(a) for a in sorted(ALIAS_TO_TICKER.keys(), key=len, reverse=True))
    combined_target = f"(?:{ticker_pattern}|{alias_pattern})"

    matches = []
    seen_tickers = set()

    # Pattern 1: "<qty> [acciones] [de] <ticker/alias>" e.g. "1 de ABC.A", "3 de RST.B", "25 acciones de TPG"
    pat1 = re.compile(
        rf"\b(\d+(?:[.,]\d+)?)\s*(?:acciones|acci[oó]n|t[ií]tulos|t[ií]tulo)?\s*(?:de\s+)?({combined_target})\b",
        re.IGNORECASE
    )
    for m in pat1.finditer(q_clean):
        qty_str, raw_target = m.group(1), m.group(2).strip()
        qty = float(qty_str.replace(",", "."))
        t_up = raw_target.upper()
        if t_up.lower() in ALIAS_TO_TICKER:
            t_up = ALIAS_TO_TICKER[t_up.lower()]
        if t_up in pos_by_ticker and t_up not in seen_tickers and qty > 0:
            seen_tickers.add(t_up)
            matches.append({"position": pos_by_ticker[t_up], "shares": int(round(qty))})

    # Pattern 2: "<ticker/alias> <qty>" e.g. "ABC.A 1 y RST.B 3"
    pat2 = re.compile(
        rf"\b({combined_target})\s+(\d+(?:[.,]\d+)?)\b",
        re.IGNORECASE
    )
    for m in pat2.finditer(q_clean):
        raw_target, qty_str = m.group(1).strip(), m.group(2)
        qty = float(qty_str.replace(",", "."))
        t_up = raw_target.upper()
        if t_up.lower() in ALIAS_TO_TICKER:
            t_up = ALIAS_TO_TICKER[t_up.lower()]
        if t_up in pos_by_ticker and t_up not in seen_tickers and qty > 0:
            seen_tickers.add(t_up)
            matches.append({"position": pos_by_ticker[t_up], "shares": int(round(qty))})

    return matches


def _build_detailed_sell_analysis(
    positions: List[Dict[str, Any]],
    cash_ves: float,
    usdt_rate: float
) -> Dict[str, Any]:
    """
    Analyzes all user positions and computes exact share counts to sell vs keep,
    gross and net proceeds in VES (accounting for ~1.36% Mercosur Casa de Bolsa fees),
    and separates winners to harvest from positions to hold untouched.
    """
    mercosur_fee_factor = 0.0136  # 1% comisión + 0.16% IVA + 0.20% aranceles BVC/CVV/SUNAVAL

    sorted_by_gain = sorted(
        positions,
        key=lambda x: float(x.get("pnl_pct_usdt", x.get("pnl_pct_ves", 0.0))),
        reverse=True
    )

    sell_candidates = []
    hold_candidates = []

    for p in sorted_by_gain:
        sh = int(round(float(p.get("shares", 0))))
        if sh <= 0:
            continue
        t_sym = p.get("ticker", "")
        h_name = human_name(t_sym, p.get("name", ""))
        pnl_u = float(p.get("pnl_pct_usdt", 0.0))
        pnl_v = float(p.get("pnl_pct_ves", 0.0))
        weight = float(p.get("weight_pct", 0.0))
        act = p.get("tactical_signal", {}).get("action", "")

        if pnl_u >= 20.0 or act in ("VENDER", "REDUCIR"):
            to_sell, to_keep = compute_tactical_shares_to_sell(sh, pnl_u, weight)
            curr_p = float(p.get("current_price_ves", 0.0))
            buy_p = float(p.get("buy_price_ves", 0.0))
            gross_ves = to_sell * curr_p
            net_ves = gross_ves * (1.0 - mercosur_fee_factor)
            net_usdt = net_ves / usdt_rate if usdt_rate > 0 else 0.0

            sell_candidates.append({
                "ticker": t_sym,
                "name": h_name,
                "shares": sh,
                "to_sell": to_sell,
                "to_keep": to_keep,
                "buy_price_ves": buy_p,
                "current_price_ves": curr_p,
                "pnl_pct_ves": pnl_v,
                "pnl_pct_usdt": pnl_u,
                "gross_ves": gross_ves,
                "net_ves": net_ves,
                "net_usdt": net_usdt,
            })
        else:
            hold_candidates.append({
                "ticker": t_sym,
                "name": h_name,
                "shares": sh,
                "buy_price_ves": float(p.get("buy_price_ves", 0.0)),
                "current_price_ves": float(p.get("current_price_ves", 0.0)),
                "pnl_pct_ves": pnl_v,
                "pnl_pct_usdt": pnl_u,
            })

    if not sell_candidates and sorted_by_gain:
        for p in sorted_by_gain[:2]:
            sh = int(round(float(p.get("shares", 0))))
            pnl_u = float(p.get("pnl_pct_usdt", 0.0))
            pnl_v = float(p.get("pnl_pct_ves", 0.0))
            if sh >= 2 and pnl_v > 0:
                t_sym = p.get("ticker", "")
                to_sell, to_keep = compute_tactical_shares_to_sell(sh, pnl_u, float(p.get("weight_pct", 0.0)))
                curr_p = float(p.get("current_price_ves", 0.0))
                gross_ves = to_sell * curr_p
                net_ves = gross_ves * (1.0 - mercosur_fee_factor)
                sell_candidates.append({
                    "ticker": t_sym,
                    "name": human_name(t_sym, p.get("name", "")),
                    "shares": sh,
                    "to_sell": to_sell,
                    "to_keep": to_keep,
                    "buy_price_ves": float(p.get("buy_price_ves", 0.0)),
                    "current_price_ves": curr_p,
                    "pnl_pct_ves": pnl_v,
                    "pnl_pct_usdt": pnl_u,
                    "gross_ves": gross_ves,
                    "net_ves": net_ves,
                    "net_usdt": net_ves / usdt_rate if usdt_rate > 0 else 0.0,
                })

    total_gross_ves = sum(c["gross_ves"] for c in sell_candidates)
    total_net_ves = sum(c["net_ves"] for c in sell_candidates)
    top3_gross_ves = sum(c["gross_ves"] for c in sell_candidates[:3])
    top3_net_ves = sum(c["net_ves"] for c in sell_candidates[:3])

    return {
        "sell_candidates": sell_candidates,
        "hold_candidates": hold_candidates,
        "total_gross_ves": total_gross_ves,
        "total_net_ves": total_net_ves,
        "top3_gross_ves": top3_gross_ves,
        "top3_net_ves": top3_net_ves,
        "new_cash_top3_ves": cash_ves + top3_net_ves,
        "new_cash_all_ves": cash_ves + total_net_ves,
    }


async def answer_bvc_ai_question(
    question: str,
    portfolio_summary: Dict[str, Any],
    rates: Dict[str, Any],
    user_plans: Optional[List[Dict[str, Any]]] = None
) -> str:
    """
    Responds to specific questions about the user's BVC portfolio or BVC stocks,
    including multi-stock sales reported by the user (e.g. 'Vendí 1 de ABC.A y 3 de RST.B'),
    always giving exact share quantities to sell/keep and speaking with a warm,
    natural, human advisor voice without markdown asterisks (**).
    """
    q_lower = question.lower().strip()
    totals = portfolio_summary.get("totals", {})
    ves_info = totals.get("ves", {})
    val_ves = float(ves_info.get("value", 0.0))
    cost_ves = float(ves_info.get("cost", 0.0))
    pnl_ves = float(ves_info.get("pnl", 0.0))
    ves_pnl = float(ves_info.get("pnl_pct", 0.0))

    usdt_info = totals.get("usdt", {})
    usdt_pnl = float(usdt_info.get("pnl_pct", 0.0))

    brecha = float(rates.get("brecha_pct", 0.0))
    bcv_rate = float(rates.get("bcv", 880.12))
    usdt_rate = float(rates.get("usdt", 999.60))
    cash_ves = float(portfolio_summary.get("cash_ves", 0.0))
    positions = portfolio_summary.get("positions", [])

    plan = _build_detailed_sell_analysis(positions, cash_ves, usdt_rate)
    sell_candidates = plan["sell_candidates"]
    hold_candidates = plan["hold_candidates"]

    # =========================================================================
    # 0. DETECTAR CUANDO EL USUARIO DICE QUE VENDIÓ O QUIERE VENDER CANTIDADES
    #    ESPECÍFICAS (Ej: "Vendí 1 de ABC.A y 3 de RST.B" o "Si vendo 2 RST.B")
    # =========================================================================
    user_trades = extract_user_trade_mentions(question, positions)
    is_past_or_sim_sale = any(
        k in q_lower for k in (
            "vendi", "vendí", "acabo de vender", "ya vendi", "ya vendí",
            "si vendo", "voy a vender", "quiero vender", "venderia", "vendería"
        )
    )

    if user_trades and (is_past_or_sim_sale or len(user_trades) >= 1):
        mercosur_fee_factor = 0.0136  # 1% comisión + 0.16% IVA + 0.20% aranceles BVC
        breakdown_lines = []
        total_gross = 0.0
        total_fees = 0.0
        total_net = 0.0
        total_realized_profit = 0.0
        sold_tickers = set()

        for idx, item in enumerate(user_trades, start=1):
            pos = item["position"]
            t_sym = pos.get("ticker", "")
            sold_tickers.add(t_sym)
            h_name = human_name(t_sym, pos.get("name", ""))
            owned_sh = int(round(float(pos.get("shares", 0))))
            sell_sh = min(item["shares"], owned_sh) if owned_sh > 0 else item["shares"]
            rem_sh = max(0, owned_sh - sell_sh)

            buy_p = float(pos.get("buy_price_ves", 0.0))
            curr_p = float(pos.get("current_price_ves", 0.0))

            gross_v = sell_sh * curr_p
            fee_v = gross_v * mercosur_fee_factor
            net_v = gross_v - fee_v
            cost_sold_v = sell_sh * buy_p
            profit_v = net_v - cost_sold_v
            profit_pct = round(((curr_p - buy_p) / buy_p) * 100, 2) if buy_p > 0 else 0.0

            total_gross += gross_v
            total_fees += fee_v
            total_net += net_v
            total_realized_profit += profit_v

            rem_text = (
                f"Te quedas con {_format_shares(rem_sh)} en cartera trabajando para ti."
                if rem_sh > 0
                else "Con esto cierras por completo tu posición en este título."
            )

            breakdown_lines.append(
                f"{idx}. Venta de {_format_shares(sell_sh)} de {h_name} ({t_sym}) a {format_currency_ves(curr_p)}:\n"
                f"   • Monto bruto: {format_currency_ves(gross_v)} (compradas a {format_currency_ves(buy_p)}, ganándole +{profit_pct}%).\n"
                f"   • Neto libre en cuenta (tras comisión Mercosur e IVA): {format_currency_ves(net_v)}.\n"
                f"   • Ganancia pura asegurada al bolsillo: +{format_currency_ves(profit_v)}.\n"
                f"   • {rem_text}"
            )

        breakdown_block = "\n\n".join(breakdown_lines)
        new_cash_ves = cash_ves + total_net
        net_usdt_eq = total_net / usdt_rate if usdt_rate > 0 else 0.0

        # Recommend what to do next with that cash!
        reinvest_options = sorted(
            [p for p in positions if p.get("ticker") not in sold_tickers],
            key=lambda x: float(x.get("pnl_pct_usdt", 0.0))
        )

        reinvest_lines = []
        # Suggest splitting the cash: e.g. keep ~40% in cash/USDT and use ~60% to reinforce lagging stocks
        invest_budget = total_net * 0.60
        reserve_cash = total_net - invest_budget

        if reinvest_options:
            per_stock_budget = invest_budget / min(2, len(reinvest_options))
            for r_pos in reinvest_options[:2]:
                r_t = r_pos.get("ticker", "")
                r_name = human_name(r_t, r_pos.get("name", ""))
                r_p = float(r_pos.get("current_price_ves", 0.0))
                r_owned = int(round(float(r_pos.get("shares", 0))))
                if r_p > 0:
                    buy_qty = max(1, int(per_stock_budget // r_p))
                    buy_cost = buy_qty * r_p
                    reinvest_lines.append(
                        f"• Sumar {_format_shares(buy_qty)} de {r_name} ({r_t}) a {format_currency_ves(r_p)} (inviertes {format_currency_ves(buy_cost)} y subes tu posición de {r_owned} a {r_owned + buy_qty} acciones)."
                    )

        reinvest_block = ""
        if reinvest_lines:
            reinvest_joined = "\n".join(reinvest_lines)
            reinvest_block = (
                f"¿Qué te recomiendo hacer ahora con esos {format_currency_ves(total_net)} libres?\n"
                f"Para hacer crecer tu cartera con esa misma ganancia sin sacar un bolívar de tu banco, yo dividiría ese dinero en dos partes:\n"
                f"1. Guarda unos {format_currency_ves(reserve_cash)} en tu saldo líquido o pásalos a USDT para asegurar tu cosecha.\n"
                f"2. Usa el resto para reforzar las acciones de tu cartera que hoy están más baratas frente al dólar:\n"
                f"{reinvest_joined}"
            )

        is_already_sold = any(k in q_lower for k in ("vendi", "vendí", "acabo de vender", "ya vendi", "ya vendí"))
        intro_line = (
            f"¡Excelente movimiento! Te felicito porque aseguraste una ganancia buenísima en bolívares y en dólares reales sin desarmar tu portafolio. "
            f"Aquí te saqué la cuenta exacta de tu liquidación:"
            if is_already_sold
            else f"¡Muy buena jugada estás planteando! Te saqué la cuenta exacta de cómo te queda esa venta:"
        )

        trades_summary_str = ", ".join([f"{item['shares']} de {item['position']['ticker']}" for item in user_trades])
        sync_note = (
            f"Nota importante: Vi que en tu tabla todavía aparecen las acciones completas sin descontar. "
            f"Puedes usar el botón Vender en tu tabla de posiciones para registrar esta salida ({trades_summary_str}) "
            f"y que esos {format_currency_ves(total_net)} se sumen de inmediato a tu saldo en efectivo."
            if is_already_sold
            else f"Si decides hacerla, dale al botón Vender en tu tabla de posiciones para cargarla y sumar esos {format_currency_ves(total_net)} a tu caja."
        )

        return clean_ai_text(
            f"{intro_line}\n\n"
            f"{breakdown_block}\n\n"
            f"Resumen total de tu venta:\n"
            f"• Total bruto de la operación: {format_currency_ves(total_gross)}\n"
            f"• Comisión Mercosur, IVA y aranceles BVC (~1,36%): -{format_currency_ves(total_fees)}\n"
            f"• Dinero neto que entra a tu cuenta: {format_currency_ves(total_net)} (equivalente a ${net_usdt_eq:.2f} USDT)\n"
            f"• Ganancia neta realizada en esta jugada: +{format_currency_ves(total_realized_profit)}\n"
            f"• Tu nuevo efectivo disponible en caja: pasa de {format_currency_ves(cash_ves)} a {format_currency_ves(new_cash_ves)}\n\n"
            f"{reinvest_block}\n\n"
            f"{sync_note}"
        )

    # =========================================================================
    # 1. SALUDO INICIAL Y CONVERSACIÓN CASUAL
    # =========================================================================
    if any(k in q_lower for k in ("hola", "buen dia", "buenos dias", "buenas tardes", "buenas noches", "saludos", "que tal", "qué tal", "quien eres", "quién eres", "como estas", "cómo estás")) and len(q_lower.split()) <= 5:
        return clean_ai_text(
            f"¡Hola! Qué gusto saludarte. Soy tu asesor de KixInvert AI y aquí estoy viendo tu portafolio de la Bolsa de Caracas en tiempo real.\n\n"
            f"Ahora mismo tu cartera vale {format_currency_ves(val_ves)} y llevas una ganancia acumulada de +{ves_pnl}% en bolívares (+{usdt_pnl}% real medido en USDT).\n\n"
            f"Pregúntame o cuéntame lo que quieras revisar hoy. Por ejemplo:\n"
            f"• ¿Cuáles y cuántas acciones me recomiendas vender hoy?\n"
            f"• Vendí 1 de ABC.A y 3 de RST.B, ¿cómo quedo y qué hago con esa plata?\n"
            f"• ¿Cómo me está protegiendo mi cartera frente al dólar?\n"
            f"• ¿En cuáles acciones me conviene comprar más?"
        )

    # =========================================================================
    # 2. CUALQUIER PREGUNTA SOBRE VENDER, TOMAR GANANCIAS, QUEDARSE O VENDER,
    #    CANTIDADES EXACTAS O QUÉ HACER CON EL PORTAFOLIO
    # =========================================================================
    is_sell_or_profit_intent = any(
        k in q_lower for k in (
            "vender", "venda", "vendo", "vendi", "vendí", "venta",
            "tomar ganancia", "tomar ganancias", "toma de ganancia", "tomo ganancia", "tomo ganancias",
            "asegurar ganancia", "asegurar ganancias", "recoger ganancia",
            "me quedo", "quedarme", "quede", "quedo", "aguanto",
            "cuantas", "cuántas", "cuantos", "cuántos", "cuales", "cuáles",
            "que cantidad", "qué cantidad", "no solo el porcentaje", "porcentaje",
            "liquidar", "salir"
        )
    )

    is_general_portfolio_advice = any(
        k in q_lower for k in (
            "que me recomiendas", "qué me recomiendas", "que opinas", "qué opinas",
            "como ves", "cómo ves", "que hago", "qué hago", "como lo ves", "cómo lo ves",
            "consejo", "aconsejas", "que harias", "qué harías", "diagnostico", "diagnóstico",
            "mejores acciones", "mejor accion", "mejor acción", "ganadoras", "ganador"
        )
    )

    if is_sell_or_profit_intent or is_general_portfolio_advice:
        if not positions:
            return clean_ai_text(
                "Todavía no veo acciones cargadas en tu portafolio. Puedes agregar tus compras con el botón Comprar en la tabla de posiciones para que saquemos juntos las cuentas exactas de cada título."
            )

        if not sell_candidates:
            hold_list = ", ".join([f"{h['name']} ({h['ticker']}: {_format_shares(h['shares'])})" for h in hold_candidates[:5]])
            return clean_ai_text(
                f"Estuve revisando tus posiciones una por una ({hold_list}) y te hablo con franqueza: hoy no te conviene vender ninguna acción todavía.\n\n"
                f"¿Por qué? Porque tus títulos aún están acumulando valor frente al dólar (tu cartera lleva +{ves_pnl}% en Bs y +{usdt_pnl}% en USDT) y ninguno ha llegado todavía a ese punto de ganancia alta (+20% o más en dólares reales) donde valga la pena pagar comisión de venta.\n\n"
                f"Lo más inteligente hoy es mantener todas tus acciones quietas trabajando para ti. Apenas alguna dé un buen estirón por encima de la inflación, te diré exactamente cuántas acciones vender para asegurar ganancia en bolívares."
            )

        lines_all = []
        for idx, c in enumerate(sell_candidates, start=1):
            sh_text = _format_shares(c["shares"])
            sell_text_unit = _format_shares(c["to_sell"])
            keep_text_unit = _format_shares(c["to_keep"])

            lines_all.append(
                f"{idx}. {c['name']} ({c['ticker']}):\n"
                f"   • Hoy tienes: {sh_text} (compradas en promedio a {format_currency_ves(c['buy_price_ves'])} y hoy están en {format_currency_ves(c['current_price_ves'])}, ganando +{c['pnl_pct_usdt']}% en USDT).\n"
                f"   • Qué hacer hoy: Vende {sell_text_unit} y quédate con {keep_text_unit}.\n"
                f"   • Dinero que recibes: {format_currency_ves(c['gross_ves'])} brutos (unos {format_currency_ves(c['net_ves'])} libres en tu cuenta descontando la comisión de Mercosur)."
            )

        detailed_sells_block = "\n\n".join(lines_all)

        if hold_candidates:
            hold_descriptions = [
                f"{h['name']} ({h['ticker']}: {_format_shares(h['shares'])}, +{h['pnl_pct_usdt']}% USDT)"
                for h in hold_candidates
            ]
            hold_block = (
                f"¿Y cuáles acciones NO debes tocar hoy?\n"
                f"Deja tranquilas tus posiciones en {', '.join(hold_descriptions)}. "
                f"Esas acciones van subiendo a buen ritmo pero todavía tienen bastante techo por recorrer, así que te sirven de escudo contra la devaluación."
            )
        else:
            hold_block = (
                "Nota: Como todas tus posiciones están en terreno positivo fuerte, al vender solo la cantidad indicada en cada una seguirás conservando la mayor parte de tus acciones trabajando por si el mercado sigue subiendo."
            )

        if len(sell_candidates) > 3:
            top3_names = ", ".join([f"{_format_shares(c['to_sell'])} de {c['ticker']}" for c in sell_candidates[:3]])
            all_names = ", ".join([f"{_format_shares(c['to_sell'])} de {c['ticker']}" for c in sell_candidates])
            cash_summary_block = (
                f"¿Cuánto efectivo te entra al bolsillo según lo que decidas?\n"
                f"• Camino conservador (vender solo en tus 3 mayores ganadoras: {top3_names}): "
                f"Cobras {format_currency_ves(plan['top3_gross_ves'])} (unos {format_currency_ves(plan['top3_net_ves'])} libres). "
                f"Tu saldo en efectivo pasaría de {format_currency_ves(cash_ves)} a {format_currency_ves(plan['new_cash_top3_ves'])}.\n"
                f"• Camino completo (recoger ganancia en las {len(sell_candidates)} acciones de la lista: {all_names}): "
                f"Cobras {format_currency_ves(plan['total_gross_ves'])} (unos {format_currency_ves(plan['total_net_ves'])} libres en cuenta). "
                f"Tu efectivo disponible subiría a {format_currency_ves(plan['new_cash_all_ves'])}."
            )
        else:
            all_names = ", ".join([f"{_format_shares(c['to_sell'])} de {c['ticker']}" for c in sell_candidates])
            cash_summary_block = (
                f"¿Cuánto efectivo te entra al bolsillo?\n"
                f"Al vender {all_names}, recibes en total {format_currency_ves(plan['total_gross_ves'])} "
                f"(aproximadamente {format_currency_ves(plan['total_net_ves'])} libres de comisión). "
                f"Con eso tu efectivo en caja sube de {format_currency_ves(cash_ves)} a {format_currency_ves(plan['new_cash_all_ves'])}, "
                f"listos para retirar o para comprar más barato cuando alguna acción baje."
            )

        return clean_ai_text(
            f"Mira, estuve sacando las cuentas exactas de tu portafolio y la verdad vas muy bien: invertiste {format_currency_ves(cost_ves)} y hoy tu cartera vale {format_currency_ves(val_ves)}, lo que significa que vas ganando {format_currency_ves(pnl_ves)} (+{ves_pnl}% en bolívares y +{usdt_pnl}% real en dólares USDT).\n\n"
            f"Mi consejo como asesor es que no vendas todo tu portafolio, porque tus acciones te están cuidando de la devaluación. Lo que sí te conviene hacer hoy es recoger parte de la cosecha en las acciones que más han subido. Aquí tienes exactamente cuáles y cuántas acciones vender de cada una:\n\n"
            f"{detailed_sells_block}\n\n"
            f"{cash_summary_block}\n\n"
            f"{hold_block}"
        )

    # =========================================================================
    # 3. CONSULTA SOBRE UNA O VARIAS ACCIONES ESPECÍFICAS DEL PORTAFOLIO
    # =========================================================================
    matched_positions = []
    seen_pos = set()
    for p in positions:
        t_sym = p.get("ticker", "")
        t_low = t_sym.lower()
        if not t_low:
            continue
        matched = False
        if t_low in q_lower.split() or f"({t_low})" in q_lower or re.search(rf"\b{re.escape(t_low)}\b", q_lower):
            matched = True
        elif "santa teresa" in q_lower and "rst" in t_low:
            matched = True
        elif "efe" in q_lower and "efe" in t_low:
            matched = True
        elif ("caribe" in q_lower or "bancaribe" in q_lower) and "abc" in t_low:
            matched = True
        elif ("telares" in q_lower or "palo grande" in q_lower) and "tpg" in t_low:
            matched = True
        elif ("proagro" in q_lower or "protinal" in q_lower) and "pgr" in t_low:
            matched = True
        elif ("vidrio" in q_lower or "favianca" in q_lower) and "fnv" in t_low:
            matched = True
        elif "cantv" in q_lower and "tdv" in t_low:
            matched = True

        if matched and t_sym not in seen_pos:
            seen_pos.add(t_sym)
            matched_positions.append(p)

    if matched_positions:
        blocks = []
        for mp in matched_positions:
            t = mp.get("ticker", "")
            n = human_name(t, mp.get("name", ""))
            sh = int(round(float(mp.get("shares", 0))))
            buy_p = float(mp.get("buy_price_ves", 0.0))
            curr_p = float(mp.get("current_price_ves", 0.0))
            pnl_v = float(mp.get("pnl_pct_ves", 0.0))
            pnl_u = float(mp.get("pnl_pct_usdt", 0.0))
            val_pos_ves = float(mp.get("val_ves", sh * curr_p))

            if pnl_u >= 20.0 and sh >= 2:
                to_sell, to_keep = compute_tactical_shares_to_sell(sh, pnl_u, float(mp.get("weight_pct", 0.0)))
                gross_v = to_sell * curr_p
                net_v = gross_v * (1.0 - 0.0136)
                blocks.append(
                    f"Sobre tu posición en {n} ({t}):\n"
                    f"• Tienes {_format_shares(sh)} compradas en promedio a {format_currency_ves(buy_p)} y hoy cotizan en {format_currency_ves(curr_p)} (valor total: {format_currency_ves(val_pos_ves)}).\n"
                    f"• Ganancia acumulada: +{pnl_v}% en bolívares (+{pnl_u}% real en dólares USDT).\n"
                    f"• Mi recomendación: Vende hoy {_format_shares(to_sell)} a {format_currency_ves(curr_p)} y quédate con {_format_shares(to_keep)} trabajando en cartera. "
                    f"Así cobras {format_currency_ves(gross_v)} brutos ({format_currency_ves(net_v)} libres en cuenta tras comisión de Mercosur) y aseguras ganancia sin salirte del título."
                )
            else:
                blocks.append(
                    f"Sobre tu posición en {n} ({t}):\n"
                    f"• Tienes {_format_shares(sh)} a un costo promedio de {format_currency_ves(buy_p)} y hoy cotizan en {format_currency_ves(curr_p)} (valor total: {format_currency_ves(val_pos_ves)}, rindiendo +{pnl_v}% en Bs / +{pnl_u}% en USDT).\n"
                    f"• Mi recomendación: Mantén tus {_format_shares(sh)} sin vender por ahora; el título se mantiene firme y aún tiene buen margen para seguir subiendo frente al dólar."
                )
        return clean_ai_text("\n\n".join(blocks))

    # =========================================================================
    # 4. "¿CUÁNDO COMPRAR MÁS? / ¿QUÉ COMPRAR HOY?"
    # =========================================================================
    if any(k in q_lower for k in ("comprar", "compro", "compre", "compra", "invertir mas", "invertir más", "donde invertir", "dónde invertir", "oportunidad", "nueva accion", "nuevas acciones", "meter mas", "meter más")):
        lagging = sorted(positions, key=lambda x: float(x.get("pnl_pct_usdt", 0.0)))[:3]
        if lagging:
            lag_lines = []
            for idx, b in enumerate(lagging, start=1):
                t_sym = b.get("ticker", "")
                h_name = human_name(t_sym, b.get("name", ""))
                curr_p = float(b.get("current_price_ves", 0.0))
                sh = int(round(float(b.get("shares", 0))))
                budget_ves = max(cash_ves, 1500.0)
                can_buy = max(1, int(budget_ves // curr_p)) if curr_p > 0 else 1
                cost_buy = can_buy * curr_p
                lag_lines.append(
                    f"{idx}. {h_name} ({t_sym}): Hoy tienes {_format_shares(sh)} y cotiza en {format_currency_ves(curr_p)} (+{b.get('pnl_pct_usdt', 0)}% en USDT). "
                    f"Está rezagada frente al resto de tu cartera; podrías sumar {_format_shares(can_buy)} invirtiendo unos {format_currency_ves(cost_buy)}."
                )
            lag_text = "\n".join(lag_lines)
            return clean_ai_text(
                f"Si estás pensando en comprar más acciones para reforzar tu cartera, lo mejor es buscar las que todavía están a buen precio frente al dólar en vez de perseguir las que ya subieron demasiado.\n\n"
                f"Viendo tu portafolio actual y tu efectivo en caja ({format_currency_ves(cash_ves)}), estas son las mejores opciones para acumular hoy:\n\n"
                f"{lag_text}\n\n"
                f"Un buen truco: si primero vendes parte de tus acciones más ganadoras (por ejemplo en RST.B, EFE o ABC.A), con esos mismos bolívares que cobras puedes comprar estas acciones rezagadas sin sacar dinero nuevo de tu banco."
            )
        else:
            return clean_ai_text(
                f"Si quieres empezar a comprar acciones en la Bolsa de Caracas hoy, enfócate en empresas con buena liquidez diaria y respaldo real:\n\n"
                f"1. Banco Nacional de Crédito (BNC): Es la acción más líquida del mercado, ideal para entrar y salir rápido.\n"
                f"2. Ron Santa Teresa (RST / RST.B): Empresa exportadora con ingresos en moneda dura.\n"
                f"3. Fábrica Nacional de Vidrios (FNV) o Proagro (PGR): Opciones accesibles en precio por acción para ir acumulando lotes."
            )

    # =========================================================================
    # 5. "¿CÓMO PROTEGE DE LA DEVALUACIÓN / BRECHA CAMBIARIA?"
    # =========================================================================
    if any(k in q_lower for k in ("devaluaci", "brecha", "dolar", "dólar", "usdt", "bcv", "inflaci", "escudo", "protege")):
        diff = round(ves_pnl - brecha, 2)
        if diff > 0:
            return clean_ai_text(
                f"Te traigo muy buenas noticias sobre cómo te está cuidando tu portafolio frente al dólar:\n\n"
                f"Hoy la brecha cambiaria entre el dólar BCV ({format_currency_ves(bcv_rate)}) y el USDT ({format_currency_ves(usdt_rate)}) está en +{brecha}%. "
                f"Mientras tanto, tus acciones llevan una ganancia de +{ves_pnl}% en bolívares, lo que representa un crecimiento real de +{usdt_pnl}% medido directamente en USDT.\n\n"
                f"En pocas palabras: no solo le ganaste a la devaluación del bolívar, sino que le llevas una ventaja neta de +{diff}% por encima del dólar paralelo. "
                f"Tener tu dinero en estas acciones en vez de dejarlo parado en bolívares te hizo ganar poder de compra real."
            )
        else:
            return clean_ai_text(
                f"Mira cómo está el panorama cambiario hoy: la brecha entre el dólar oficial BCV ({format_currency_ves(bcv_rate)}) y el USDT ({format_currency_ves(usdt_rate)}) es de +{brecha}%, mientras tu portafolio acumula +{ves_pnl}% en bolívares.\n\n"
                f"En la Bolsa de Caracas es normal que el dólar se mueva primero y luego las acciones peguen el salto para alcanzarlo. "
                f"Por eso te conviene mantener tus títulos en empresas sólidas como Ron Santa Teresa, BNC o Bancaribe, que suelen ajustar sus precios al alza para recuperar terreno frente al dólar."
            )

    # =========================================================================
    # 6. DIVERSIFICACIÓN BIMONETARIA Y WALL STREET
    # =========================================================================
    if any(k in q_lower for k in ("diversific", "bimonetari", "global", "wall street", "internacional", "eeuu", "estados unidos", "sp500", "s&p", "nasdaq", "nyse", "aapl", "apple", "nvda", "nvidia", "tsla", "tesla", "spy", "qqq", "msft")):
        m_breakdown = portfolio_summary.get("market_breakdown", {})
        bvc_p = m_breakdown.get("bvc_pct", 100.0)
        intl_p = m_breakdown.get("intl_pct", 0.0)
        return clean_ai_text(
            f"Hoy tienes el {bvc_p}% de tu inversión en la Bolsa de Caracas (BVC) y el {intl_p}% en Wall Street.\n\n"
            f"Combinar ambos mercados es una excelente estrategia: las acciones de Caracas aprovechan los saltos cuando los precios locales corrigen la inflación en bolívares, mientras que tener una parte en Wall Street (como el S&P 500 SPY, Apple o Nvidia) guarda tu patrimonio directamente en dólares estadounidenses."
        )

    # =========================================================================
    # 7. RESPUESTA POR DEFECTO (RESUMEN HUMANO CON CANTIDADES EXACTAS)
    # =========================================================================
    if sell_candidates:
        top_c = sell_candidates[0]
        top_suggestion = (
            f"Por ejemplo, en {top_c['name']} ({top_c['ticker']}) tienes {_format_shares(top_c['shares'])} ganando +{top_c['pnl_pct_usdt']}% en USDT; "
            f"hoy podrías vender {_format_shares(top_c['to_sell'])} para cobrar {format_currency_ves(top_c['gross_ves'])} y quedarte con {_format_shares(top_c['to_keep'])}."
        )
    else:
        top_suggestion = "Por ahora todas tus acciones están en zona de mantener para seguir acumulando valor."

    return clean_ai_text(
        f"Aquí tienes el resumen claro de tu portafolio hoy: invertiste {format_currency_ves(cost_ves)} y tus acciones valen actualmente {format_currency_ves(val_ves)}, con una ganancia de {format_currency_ves(pnl_ves)} (+{ves_pnl}% en bolívares y +{usdt_pnl}% real en USDT).\n\n"
        f"{top_suggestion}\n\n"
        f"Si quieres que revisemos el plan completo acción por acción, escríbeme: ¿Cuáles y cuántas acciones me recomiendas vender hoy?"
    )
