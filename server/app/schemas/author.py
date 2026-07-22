
from pydantic import BaseModel, ConfigDict


class AuthorBase(BaseModel):
    name: str
    bio: str | None = None

class AuthorCreate(AuthorBase):
    pass

class AuthorResponse(AuthorBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
