from fastapi import HTTPException, status


class BookFinderException(HTTPException):
    def __init__(self, status_code: int, detail: str):
        super().__init__(status_code=status_code, detail=detail)

class EntityNotFoundException(BookFinderException):
    def __init__(self, entity_name: str, entity_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{entity_name} with id/key '{entity_id}' was not found."
        )

class AuthException(BookFinderException):
    def __init__(self, detail: str = "Could not validate credentials"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail
        )

class CredentialsException(AuthException):
    def __init__(self):
        super().__init__(detail="Invalid credentials or expired tokens")

class UserAlreadyExistsException(BookFinderException):
    def __init__(self, email: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A user with email '{email}' already exists."
        )

class ActionForbiddenException(BookFinderException):
    def __init__(self, detail: str = "Operation not permitted"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )
