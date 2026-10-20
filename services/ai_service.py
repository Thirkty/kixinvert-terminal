import os
import datetime
import httpx
from typing import Dict, Any, List, Optional

# Check if an API key is available in environment
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

def generate_local_ai_diagnosis(portfolio_summary: Dict[str, Any], rates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Financial AI Engine specifically tailored for the Venezuelan Stock Market (BVC).
    Analyzes portfolio diversification, real vs nominal returns, FX gap (brecha cambiaria),
    and generates tactical recommendations for each asset.
    """
    totals = portfolio_summary.get("totals", {})
    ves_pnl_pct = totals.get("ves", {}).get("pnl_pct", 0.0)
    usd_bcv_pnl_pct = totals.get("usd_bcv", {}).get("pnl_pct", 0.0)
    usdt_pnl_pct = totals.get("usdt", {}).get("pnl_pct", 0.0)
    total_val_ves = totals.get("ves", {}).get("value", 0.0)
    
    brecha = rates.get("brecha_pct", 0.0)
    bcv = rates.get("bcv", 879.12)
    usdt = rates.get("usdt", 1007.95)

    positions = portfolio_summary.get("positions", [])
    
    # 1. Sector Allocation Analysis
    sectors = {}
    for p in positions:
        sec = p.get("sector") or "Otros"
        sectors[sec] = sectors.get(sec, 0.0) + p.get("weight_pct", 0.0)
    
    top_sector = max(sectors.items(), key=lambda x: x[1]) if sectors else ("Renta Variable", 100.0)

    # 2. Real Yield vs Currency Devaluation Assessment
    # If nominal return in Bs > brecha %, the investor generated REAL wealth above FX devaluation
    beats_devaluation = ves_pnl_pct > brecha
    spread_diff = round(ves_pnl_pct - brecha, 2)

    if beats_devaluation:
        devaluation_status = "Excelente Cobertura"
        devaluation_badge = "success"
        devaluation_comment = (
            f"Tu portafolio rinde +{ves_pnl_pct}% en Bolívares, superando la brecha cambiaria del {brecha}%. "
            f"Estás generando una ganancia real neta de +{spread_diff}% por encima de la devaluación informal (USDT)."
        )
    else:
        devaluation_status = "Riesgo Cambiario"
        devaluation_badge = "warning"
        devaluation_comment = (
            f"Tu portafolio rinde +{ves_pnl_pct}% en Bolívares mientras la brecha BCV-USDT es de +{brecha}%. "
            f"La devaluación del paralelo/USDT está absorbiendo parte del poder de compra de tus títulos."
        )

    # 3. Tactical Asset Analysis & Highlights
    top_winner = max(positions, key=lambda x: x.get("pnl_pct_usdt", x.get("pnl_pct_ves", 0.0))) if positions else None
    laggard = min(positions, key=lambda x: x.get("pnl_pct_usdt", x.get("pnl_pct_ves", 0.0))) if positions else None

    asset_recommendations = []
    tactical_sells = []
    tactical_buys = []
    tactical_rotates = []
    tactical_holds = []

    from services.portfolio_service import compute_tactical_signal

    for p in positions:
        ticker = p.get("ticker")
        pnl_ves = p.get("pnl_pct_ves", 0.0)
        pnl_usdt = p.get("pnl_pct_usdt", 0.0)
        weight = p.get("weight_pct", 0.0)
        change_today = p.get("change_today_pct", 0.0)

        sig = p.get("tactical_signal")
        if not sig:
            sig = compute_tactical_signal(
                pnl_pct_usdt=pnl_usdt,
                pnl_pct_ves=pnl_ves,
                weight_pct=weight,
                change_today_pct=change_today,
                brecha_pct=brecha
            )

        asset_recommendations.append({
            "ticker": ticker,
            "name": p.get("name"),
            "weight_pct": weight,
            "pnl_pct_ves": pnl_ves,
            "pnl_pct_usdt": pnl_usdt,
            "recommendation": sig.get("recommendation", "Mantener"),
            "action": sig.get("action", "MANTENER"),
            "label": sig.get("label"),
            "action_text": sig.get("action_text"),
            "rationale": sig.get("rationale"),
            "badge_type": sig.get("type", "neutral"),
            "badge_color": sig.get("badge_color", "neutral"),
            "icon": sig.get("icon", "shield-check")
        })

        act = sig.get("action")
        if act in ("VENDER", "REDUCIR"):
            tactical_sells.append({"ticker": ticker, "sig": sig})
        elif act == "COMPRAR":
            tactical_buys.append({"ticker": ticker, "sig": sig})
        elif act == "ROTAR":
            tactical_rotates.append({"ticker": ticker, "sig": sig})
        else:
            tactical_holds.append({"ticker": ticker, "sig": sig})

    # 4. Overall Portfolio Health Score (0 - 100)
    health_score = 50
    if usdt_pnl_pct > 15: health_score += 30
    elif usdt_pnl_pct > 5: health_score += 20
    elif ves_pnl_pct > 15: health_score += 15
    
    if beats_devaluation: health_score += 15
    if len(positions) >= 4: health_score += 10 # Good diversification

    health_score = min(100, max(10, health_score))

    summary_narrative = (
        f"Diagnóstico KixInvert AI: Tu cartera se encuentra en un estado muy saludable con un rendimiento consolidado "
        f"de +{ves_pnl_pct}% en Bolívares (+{usdt_pnl_pct}% en USDT real). "
        f"El sector predominante es '{top_sector[0]}' con un {top_sector[1]}% de concentración. "
        f"Destacan posiciones como {top_winner.get('ticker') if top_winner else 'N/A'} con un rendimiento estelar "
        f"de +{top_winner.get('pnl_pct_usdt', 0)}% USDT (+{top_winner.get('pnl_pct_ves', 0)}% Bs). "
        f"Señales tácticas activas: {len(tactical_sells)} ventas recomendadas, {len(tactical_buys)} compras en rezago y {len(tactical_holds)} en retención."
    )

    return {
        "health_score": health_score,
        "health_status": "Excelente" if health_score >= 80 else ("Saludable" if health_score >= 60 else "Moderado"),
        "summary_narrative": summary_narrative,
        "devaluation_status": devaluation_status,
        "devaluation_badge": devaluation_badge,
        "devaluation_comment": devaluation_comment,
        "top_sector": {"name": top_sector[0], "weight": top_sector[1]},
        "asset_recommendations": asset_recommendations,
        "tactical_actions": {
            "sells_count": len(tactical_sells),
            "buys_count": len(tactical_buys),
            "rotates_count": len(tactical_rotates),
            "holds_count": len(tactical_holds)
        },
        "timestamp": datetime.datetime.now().strftime("%d/%m/%Y %I:%M %p")
    }

async def answer_bvc_ai_question(
    question: str,
    portfolio_summary: Dict[str, Any],
    rates: Dict[str, Any],
    user_plans: Optional[List[Dict[str, Any]]] = None
) -> str:
    """
    Responds to specific questions about the user's BVC portfolio or BVC stocks,
    including tactical buy/sell/hold decisions.
    """
    q_lower = question.lower()
    totals = portfolio_summary.get("totals", {})
    ves_pnl = totals.get("ves", {}).get("pnl_pct", 0.0)
    usdt_pnl = totals.get("usdt", {}).get("pnl_pct", 0.0)
    brecha = rates.get("brecha_pct", 0.0)
    positions = portfolio_summary.get("positions", [])

    # Check if Gemini API key exists
    if GEMINI_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                prompt = (
                    f"Eres KixInvert AI, el analista financiero experto en la Bolsa de Valores de Caracas (BVC). "
                    f"Datos actuales del usuario: Portafolio rinde +{ves_pnl}% en Bolívares y +{usdt_pnl}% en USDT real. "
                    f"Brecha oficial BCV vs USDT: {brecha}%. Tasa BCV: {rates.get('bcv')} Bs, USDT: {rates.get('usdt')} Bs. "
                    f"Posiciones: {[p['ticker'] + ': ' + str(p['shares']) + ' acciones, PnL USDT: ' + str(p.get('pnl_pct_usdt')) + '%, Señal: ' + str(p.get('tactical_signal', {}).get('label')) for p in positions]}. "
                    f"Pregunta del usuario: '{question}'. "
                    f"Responde de forma concisa, profesional, práctica y clara, siempre con lenguaje financiero venezolano. Si preguntan cuándo vender o comprar más, da recomendaciones específicas con porcentajes sugeridos."
                )
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
                res = await client.post(url, json={"contents": [{"parts": [{"text": prompt}]}]})
                if res.status_code == 200:
                    data = res.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception:
            pass

    # =========================================================================
    # SPECIALIZED TACTICAL HEURISTIC HANDLERS ("CUÁNDO VENDER / CUÁNDO COMPRAR")
    # =========================================================================

    # 1. "¿CUÁNDO VENDER? / ¿QUÉ VENDER HOY?"
    if any(k in q_lower for k in ("vender", "vendo", "toma de ganancia", "tomar ganancia", "salir", "liquidar")):
        sells = [p for p in positions if p.get("tactical_signal", {}).get("action") in ("VENDER", "REDUCIR")]
        if sells:
            items_text = "\n".join([
                f"• **{s['ticker']} ({s['name']}):** {s['tactical_signal']['label']}. "
                f"_{s['tactical_signal']['action_text']}_. {s['tactical_signal']['rationale']}"
                for s in sells
            ])
            return (
                f"🎯 **Señales Tácticas de Venta (Take Profit):**\n\n"
                f"Con base en el rendimiento real de tu portafolio frente al dólar (USDT), sugerimos evaluar las siguientes acciones:\n\n"
                f"{items_text}\n\n"
                f"💡 **Consejo Táctico:** En el mercado venezolano no es necesario vender el 100% de la posición. "
                f"Vender un 30% a 50% te permite realizar ganancias en USDT manteniendo exposición a futuros dividendos o subidas."
            )
        else:
            return (
                f"🎯 **¿Cuándo Vender?:** En este momento ninguno de tus títulos ha superado el umbral de sobrecalentamiento (+25% a +40% en USDT) "
                f"ni presenta sobreconcentración crítica (>35%).\n\n"
                f"✅ **Estrategia sugerida:** **Mantener posiciones (Hold)** para continuar acumulando apreciación de capital y dividendos. "
                f"Te avisaremos en cuanto una de tus acciones alcance un nivel óptimo para asegurar beneficios."
            )

    # 2. "¿CUÁNDO COMPRAR MÁS? / ¿QUÉ COMPRAR HOY?"
    if any(k in q_lower for k in ("comprar", "compro", "invertir mas", "invertir más", "donde invertir", "dónde invertir", "oportunidad")):
        buys = [p for p in positions if p.get("tactical_signal", {}).get("action") == "COMPRAR"]
        if buys:
            items_text = "\n".join([
                f"• **{b['ticker']} ({b['name']}):** {b['tactical_signal']['label']}. "
                f"{b['tactical_signal']['rationale']}"
                for b in buys
            ])
            return (
                f"🛒 **Oportunidades de Compra / Invertir Más:**\n\n"
                f"Detectamos los siguientes activos con rezago de precio frente al dólar o punto favorable de entrada:\n\n"
                f"{items_text}\n\n"
                f"💡 **Estrategia sugerida:** Puedes promediar costo de compra en estos activos utilizando el saldo líquido de tu portafolio en Bolívares o USD."
            )
        else:
            return (
                f"🛒 **¿Cuándo Invertir Más?:** Actualmente tus títulos cotizan cerca de su balance frente al dólar.\n\n"
                f"Si cuentas con liquidez y buscas ampliar cartera, las acciones con mayor bursatilidad y volumen diario en la BVC son:\n"
                f"1. **Banco Nacional de Crédito (BNC):** Líder en rueda y liquidez.\n"
                f"2. **Ron Santa Teresa B (RST.B):** Respaldo exportador dolarizado.\n"
                f"3. **Banco Provincial (BPV):** Solidez institucional y dividendos.\n\n"
                f"Recomendamos realizar compras escalonadas en sesiones donde el título retroceda un -2% a -4% intradía."
            )

    # 3. "¿CÓMO PROTEGE DE LA DEVALUACIÓN / BRECHA?"
    if any(k in q_lower for k in ("devaluaci", "brecha", "dolar", "dólar", "usdt", "inflaci")):
        diff = round(ves_pnl - brecha, 2)
        if diff > 0:
            return (
                f"🛡️ **Protección de tu patrimonio:** Actualmente tu portafolio rinde **+{ves_pnl}% en Bolívares** "
                f"(**+{usdt_pnl}% en USDT real**), mientras que la brecha cambiaria (BCV vs USDT) se ubica en **+{brecha}%**.\n\n"
                f"✅ **Tu inversión está superando a la devaluación informal con un colchón neto de +{diff}%**. "
                f"Tus acciones en la BVC han actuado como un excelente escudo inflacionario."
            )
        else:
            return (
                f"⚠️ **Alerta Cambiaria:** La brecha cambiaria actual (+{brecha}%) supera el rendimiento nominal de tu cartera (+{ves_pnl}%).\n\n"
                f"Para no perder poder de compra en términos de reposición en USDT, conviene monitorear acciones con mayor volumen como BNC, RST.B o MVZ.A."
            )

    # 4. RON SANTA TERESA
    if "santa teresa" in q_lower or "rst" in q_lower:
        rst_b = next((p for p in positions if "RST" in p["ticker"]), None)
        pnl = rst_b.get("pnl_pct_usdt", rst_b.get("pnl_pct_ves", 0.0)) if rst_b else 16.67
        return (
            f"🥃 **Análisis de Ron Santa Teresa (RST / RST.B):** Es uno de los activos más dinámicos de la Bolsa de Caracas. "
            f"Tu posición acumula un rendimiento de **+{pnl}%**.\n\n"
            f"Es una empresa exportadora con ingresos dolarizados y fuerte respaldo de marca. "
            f"Estrategia sugerida: Mantener con sesgo alcista, pero considerando tomar beneficios parciales si tu ganancia real en USDT supera el +30%."
        )

    # 5. BANCA
    if "bnc" in q_lower or "banco" in q_lower or "banca" in q_lower:
        return (
            f"🏦 **Sector Bancario (BNC, BPV, ABC.A):** La banca venezolana cotiza con múltiplos de valuación históricamente atractivos.\n\n"
            f"El Banco Nacional de Crédito (BNC) es el líder en liquidez y volumen diario transado en la BVC. "
            f"Es un título ideal para mantener liquidez operativa y rotación de cartera."
        )

    # 6. RECOMENDACIÓN GENERAL DEL DÍA
    if any(k in q_lower for k in ("mejor", "ganador", "recomiend", "dia", "día", "hoy")):
        sorted_pos = sorted(positions, key=lambda x: x.get("pnl_pct_usdt", 0.0), reverse=True)
        top_str = ""
        if sorted_pos:
            top_1 = sorted_pos[0]
            top_str += f"1. **Rendimiento Real Líder:** {top_1.get('ticker')} (+{top_1.get('pnl_pct_usdt')}% USDT). "
            if len(sorted_pos) > 1:
                top_2 = sorted_pos[1]
                top_str += f"Seguido de {top_2.get('ticker')} (+{top_2.get('pnl_pct_usdt')}% USDT). "
        else:
            top_str = "1. **Rendimiento Líder:** Mantén vigilancia en acciones con alto volumen diario como BNC y RST.B. "
        
        return (
            f"📈 **Recomendación Táctica KixInvert AI:**\n\n"
            f"{top_str}\n"
            f"2. **Disciplina de Ganancias:** Si un título supera el +25% en USDT, toma beneficio parcial del 30% para asegurar capital.\n"
            f"3. **Liquidez Operativa:** Mantén un 5% a 10% en efectivo para aprovechar compras en retrocesos técnicos de la BVC."
        )

    # 7. DIVERSIFICACIÓN BIMONETARIA (BVC + WALL STREET)
    if any(k in q_lower for k in ("diversific", "bimonetari", "global", "caracas y wall street", "bvc y")):
        m_breakdown = portfolio_summary.get("market_breakdown", {})
        bvc_p = m_breakdown.get("bvc_pct", 100.0)
        intl_p = m_breakdown.get("intl_pct", 0.0)
        return (
            f"🌐 **Estrategia Bimonetaria KixInvert (Caracas + Wall Street):**\n\n"
            f"Tu distribución actual en renta variable es: **{bvc_p}% en BVC (Caracas)** y **{intl_p}% en Wall Street**.\n\n"
            f"🎯 **La regla de oro bimonetaria:**\n"
            f"1. **BVC (50%-70%):** Genera altos picos de rentabilidad cuando los precios de las acciones locales corrigen con fuerza tras las devaluaciones del BCV.\n"
            f"2. **Wall Street (30%-50%):** Preserva el capital en dólares duros invirtiendo en empresas con ingresos globales (ej. SPY, AAPL, MSFT).\n"
            f"Esta sinergia te brinda lo mejor de ambos mundos sin salir de KixInvertAPP."
        )

    # 8. WALL STREET & ACCIONES INTERNACIONALES (PHASE 3)
    if any(k in q_lower for k in ("wall street", "internacional", "eeuu", "estados unidos", "sp500", "s&p", "nasdaq", "nyse", "aapl", "apple", "nvda", "nvidia", "tsla", "tesla", "spy", "qqq", "msft", "microsoft")):
        intl_positions = [p for p in positions if p.get("market") != "BVC" or p.get("is_international")]
        if intl_positions:
            intl_items = "\n".join([
                f"• **{p['ticker']} ({p['name']}):** {p.get('shares')} títulos a ${p.get('current_price_usd_bcv')} USD | Retorno: +{p.get('pnl_pct_usd_bcv', 0)}% USD (+{p.get('pnl_pct_usdt', 0)}% USDT)."
                for p in intl_positions
            ])
            return (
                f"🇺🇸 **Tus Inversiones en Wall Street / Internacional:**\n\n"
                f"{intl_items}\n\n"
                f"💡 **Análisis KixInvert:** Tus acciones internacionales están denominadas nativamente en dólares estadounidenses, "
                f"lo cual elimina al 100% el riesgo cambiario del bolívar y te expone al crecimiento global. "
                f"Te recomendamos mantener una asignación equilibrada entre títulos de innovación (ej. NVDA, AAPL) y fondos indexados (SPY)."
            )
        else:
            return (
                f"🇺🇸 **Inversión Internacional / Wall Street en KixInvertAPP:**\n\n"
                f"Ahora puedes añadir y monitorear acciones globales (NYSE, NASDAQ y ETFs) como **Apple (AAPL)**, **NVIDIA (NVDA)**, "
                f"**Tesla (TSLA)** y el índice **S&P 500 (SPY)** con cotización en tiempo real vía Yahoo Finance.\n\n"
                f"🛡️ **Ventaja Clave para Inversores en Venezuela:** Al combinar acciones de la Bolsa de Caracas (BVC) con Wall Street, "
                f"obtienes un portafolio bimonetario que aprovecha el rezago cambiario local mientras blinda tu patrimonio con activos dolarizados de clase mundial."
            )

    # 9. PLANES DE AHORRO PROGRAMADO & DCA (PHASE 4)
    if any(k in q_lower for k in ("ahorro", "ahorrar", "plan", "dca", "interes compuesto", "interés compuesto", "meta", "acumulacion", "acumulación")):
        if user_plans and len(user_plans) > 0:
            plans_text = []
            for p in user_plans:
                flag = "🇻🇪" if p.get("ecosystem") == "BVC" else "🇺🇸"
                t_ticker = f" ({p.get('target_ticker')})" if p.get('target_ticker') else ""
                plans_text.append(
                    f"• {flag} **{p.get('name')}{t_ticker}:** {p.get('progress_pct')}% alcanzado "
                    f"({p.get('current_saved'):,.2f} / {p.get('target_amount'):,.2f} {p.get('currency')}). "
                    f"Aporte programado: {p.get('installment_amount'):,.2f} {p.get('currency')} ({p.get('frequency', 'MENSUAL').lower()})."
                )
            plans_joined = "\n".join(plans_text)
            return (
                f"🎯 **Tus Planes de Ahorro Programado (DCA):**\n\n"
                f"{plans_joined}\n\n"
                f"💡 **Consejo KixInvert AI:** Mantener la constancia en cada cuota (Dollar Cost Averaging) "
                f"neutraliza la volatilidad temporal de los mercados y activa la fuerza exponencial del interés compuesto."
            )
        else:
            return (
                f"🎯 **Planes de Ahorro Programado & DCA (Dollar Cost Averaging):**\n\n"
                f"En KixInvertAPP puedes estructurar metas de acumulación periódica automática para la **Bolsa de Caracas (BVC)** o **Wall Street (ETFs como SPY / QQQ)**.\n\n"
                f"📈 **Ventajas del DCA con Interés Compuesto:**\n"
                f"1. **Disciplina sin Estrés:** Eliminas la necesidad de adivinar el mejor día o precio para entrar al mercado.\n"
                f"2. **Efecto Multiplicador:** Un ahorro constante de **$50 USD/mes** en el índice S&P 500 (~10.5% anual) puede proyectar **más de $3,900 USD en 5 años** (con casi $1,000 en ganancias puras por interés compuesto).\n"
                f"3. **Blindaje en Venezuela:** Aportar periódicamente en acciones BVC de alta liquidez como BNC o Ron Santa Teresa protege el poder de compra de tus ingresos frente a la devaluación.\n\n"
                f"👉 Puedes simular escenarios y crear tu plan personalizado en la pestaña **Planes de Ahorro DCA 🎯**."
            )

    num_pos = len(positions)
    pos_tickers = ", ".join([p.get("ticker", "") for p in positions[:4]]) if positions else "acciones BVC"
    return (
        f"🤖 **Diagnóstico KixInvert AI:** Tu portafolio en la Bolsa de Caracas cuenta con {num_pos} "
        f"{'títulos' if num_pos != 1 else 'título'} ({pos_tickers}) y un rendimiento "
        f"global de **+{ves_pnl}% Bs (+{usdt_pnl}% USDT)**.\n\n"
        f"Puedes consultarme directamente: *'¿Qué vendo hoy?'*, *'¿En qué invertir más?'* o *'¿Cómo está la brecha cambiaria?'*."
    )

