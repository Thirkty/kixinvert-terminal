"""Centro de notificaciones."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db import get_db
from models import User
import services.notification_service as notification_service
from deps import get_current_user

router = APIRouter()


@router.get("/api/notifications")
async def api_get_notifications(
    category: Optional[str] = Query(None, description="Category filter: tactical, market, or all"),
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.id if current_user else None
    notifications = notification_service.get_user_notifications(db, user_id=user_id, category=category, limit=limit)
    unread_count = notification_service.get_unread_count(db, user_id=user_id)
    return {
        "unread_count": unread_count,
        "notifications": notifications
    }

@router.post("/api/notifications/{notification_id}/read")
async def api_mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.id if current_user else None
    success = notification_service.mark_notification_read(db, notification_id, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notificación no encontrada.")
    unread_count = notification_service.get_unread_count(db, user_id=user_id)
    return {"status": "ok", "unread_count": unread_count}

@router.post("/api/notifications/read-all")
async def api_mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.id if current_user else None
    count = notification_service.mark_all_notifications_read(db, user_id=user_id)
    return {"status": "ok", "marked_read": count, "unread_count": 0}
