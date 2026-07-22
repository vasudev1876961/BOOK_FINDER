from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.auth.security import get_password_hash, verify_password, verify_token
from app.core.config import settings
from app.core.exceptions import (
    AuthException,
    CredentialsException,
    UserAlreadyExistsException,
)
from app.database.database import get_db
from app.database.models.user import User
from app.schemas.user import UserCreate

# OAuth2 scheme config (pointing to token login endpoint)
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)

def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()

def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

def create_new_user(db: Session, user_in: UserCreate) -> User:
    existing_user = get_user_by_email(db, user_in.email)
    if existing_user:
        raise UserAlreadyExistsException(email=user_in.email)

    hashed_pw = get_password_hash(user_in.password)
    db_user = User(
        email=user_in.email,
        hashed_password=hashed_pw,
        full_name=user_in.full_name,
        role="user"  # Default role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    email = verify_token(token, token_type="access")
    if email is None:
        raise CredentialsException()

    user = get_user_by_email(db, email)
    if user is None:
        raise CredentialsException()
    if not user.is_active:
        raise AuthException("Inactive user account")
    return user

def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    if current_user.role != "admin":
        from app.core.exceptions import ActionForbiddenException
        raise ActionForbiddenException("Admin access required")
    return current_user


oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False
)

def get_optional_current_user(
    db: Session = Depends(get_db),
    token: str | None = Depends(oauth2_scheme_optional)
) -> User | None:
    if not token:
        return None
    try:
        email = verify_token(token, token_type="access")
        if email is None:
            return None
        return get_user_by_email(db, email)
    except Exception:
        return None
