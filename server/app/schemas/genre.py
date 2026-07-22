from pydantic import BaseModel, ConfigDict


class GenreBase(BaseModel):
    name: str

class GenreCreate(GenreBase):
    pass

class GenreResponse(GenreBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
