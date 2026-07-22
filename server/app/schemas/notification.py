from datetime import datetime

from pydantic import BaseModel


class NotificationBase(BaseModel):
    title: str
    message: str

class NotificationCreate(NotificationBase):
    user_id: int

class NotificationUpdate(BaseModel):
    is_read: bool

class NotificationResponse(NotificationBase):
    id: int
    user_id: int
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
        # Pydantic v2 configuration
        json_schema_extra = {
            "example": {
                "id": 1,
                "user_id": 2,
                "title": "New Recommendation",
                "message": "We found some books you might like!",
                "is_read": False,
                "created_at": "2026-07-17T12:00:00Z"
            }
        }
