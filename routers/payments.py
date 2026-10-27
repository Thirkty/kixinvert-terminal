"""Plan PRO: precio, compra con Binance Pay y estado de la orden."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from db import get_db
from models import User, PaymentOrder
from services import payment_service
from deps import limiter, get_current_user, check_and_refresh_user_subscription, log_audit

router = APIRouter()


@router.get("/api/payments/plan")
def get_plan(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    is_pro = check_and_refresh_user_subscription(current_user, db)
    return {
        "payments_available": payment_service.is_configured(),
        "price_usdt": payment_service.PRO_PRICE_USDT,
        "days": payment_service.PRO_DAYS,
        "is_pro": is_pro,
        "expires_at": current_user.subscription_expires_at.isoformat() if is_pro and current_user.subscription_expires_at else None,
        "ai_queries_used_this_month": current_user.ai_queries_used_this_month or 0,
        "ai_queries_limit": None if is_pro else 10,
    }


@router.post("/api/payments/binance/order")
@limiter.limit("5/minute")
def create_binance_order(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        order = payment_service.create_order(db, current_user)
    except payment_service.PaymentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    log_audit(db, "PAYMENT_ORDER_CREATED", user_id=current_user.id, request=request, details=order["order_id"])
    return order


@router.get("/api/payments/order/{order_id}")
@limiter.limit("30/minute")
def get_order_status(order_id: str, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    order = db.query(PaymentOrder).filter(PaymentOrder.order_id == order_id, PaymentOrder.user_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada.")
    try:
        status = payment_service.refresh_order(db, order)
    except payment_service.PaymentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {"order_id": order.order_id, "status": status}


@router.post("/api/payments/binance/webhook")
async def binance_webhook(request: Request, db: Session = Depends(get_db)):
    # The notification only tells us which order to check; the result always comes from querying Binance
    try:
        body = await request.json()
    except Exception:
        body = {}
    order = payment_service.order_from_webhook(db, body)
    if order:
        try:
            payment_service.refresh_order(db, order)
        except payment_service.PaymentError:
            pass
    return {"returnCode": "SUCCESS", "returnMessage": None}
