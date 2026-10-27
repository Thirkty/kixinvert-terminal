"""Chat con KixInvert AI."""
import re
from typing import Optional
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db import get_db
from models import User
from services.rates_service import fetch_current_rates
from services.portfolio_service import get_portfolio_summary
from services.ai_service import answer_bvc_ai_question
from deps import limiter, get_current_user, check_and_refresh_user_subscription

router = APIRouter()


class AIChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    demo_count: Optional[int] = Field(0, ge=0, le=100)


@router.post("/api/ai/chat")
@limiter.limit("15/minute")
async def chat_with_bvc_ai(
    req: AIChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Free tier: 10 queries per month, counted on the server
    is_pro = check_and_refresh_user_subscription(current_user, db)
    if not is_pro and (current_user.ai_queries_used_this_month or 0) >= 10:
        return {
            "answer": (
                "Llegaste al límite de 10 consultas de este mes en el Plan Gratuito.\n\n"
                "Con el Plan PRO (5 USDT por 30 días, con Binance Pay) las consultas son ilimitadas. "
                "Actívalo en Mi cuenta: toca tu usuario arriba a la derecha."
            ),
            "limit_reached": True,
            "subscription_tier": "free",
            "queries_used": current_user.ai_queries_used_this_month,
            "queries_remaining": 0,
            "queries_limit": 10,
            "upgrade_required": True
        }

    # Plain text: React escapes it on render, so HTML-escaping here would show "&quot;" in answers
    question = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", req.question).strip()[:500]

    rates = await fetch_current_rates(db)
    summary = get_portfolio_summary(db, rates["bcv"], rates["usdt"], user_id=current_user.id)
    answer = await answer_bvc_ai_question(question, summary, rates)

    current_user.ai_queries_used_this_month = (current_user.ai_queries_used_this_month or 0) + 1
    db.commit()
    db.refresh(current_user)

    subscription_tier = "pro" if is_pro else "free"
    queries_used = current_user.ai_queries_used_this_month
    queries_limit = None if is_pro else 10
    queries_remaining = "ilimitadas" if is_pro else max(0, 10 - current_user.ai_queries_used_this_month)

    return {
        "answer": answer,
        "limit_reached": False,
        "subscription_tier": subscription_tier,
        "queries_used": queries_used,
        "queries_remaining": queries_remaining,
        "queries_limit": queries_limit
    }
