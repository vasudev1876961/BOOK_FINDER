from pydantic import BaseModel, ConfigDict


class PublisherBase(BaseModel):
    name: str

class PublisherCreate(PublisherBase):
    pass

class PublisherResponse(PublisherBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
