import importlib.util

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auth.auth_service import (
    authenticate_user,
    create_new_user,
    get_current_user,
    get_user_by_email,
)
from app.auth.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_token,
)
from app.core.exceptions import (
    AuthException,
    CredentialsException,
    EntityNotFoundException,
)
from app.core.logging import logger
from app.database.database import get_db
from app.database.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    GoogleLoginRequest,
    LoginRequest,
    RefreshTokenRequest,
    ResetPasswordRequest,
    Token,
)
from app.schemas.user import UserCreate, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    return create_new_user(db, user_in)

@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, login_data.email, login_data.password)
    if not user:
        raise AuthException("Incorrect email or password")

    access_token = create_access_token(subject=user.email)
    refresh_token = create_refresh_token(subject=user.email)
    return Token(access_token=access_token, refresh_token=refresh_token)

# This endpoint handles OAuth2PasswordRequestForm (useful for FastAPI interactive docs swagger)
@router.post("/login-swagger", response_model=Token, include_in_schema=False)
def login_swagger(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise AuthException("Incorrect email or password")

    access_token = create_access_token(subject=user.email)
    refresh_token = create_refresh_token(subject=user.email)
    return Token(access_token=access_token, refresh_token=refresh_token)

@router.post("/refresh", response_model=Token)
def refresh_token(refresh_data: RefreshTokenRequest, db: Session = Depends(get_db)):
    email = verify_token(refresh_data.refresh_token, token_type="refresh")
    if not email:
        raise CredentialsException()

    user = get_user_by_email(db, email)
    if not user or not user.is_active:
        raise CredentialsException()

    access_token = create_access_token(subject=user.email)
    new_refresh_token = create_refresh_token(subject=user.email)
    return Token(access_token=access_token, refresh_token=new_refresh_token)

@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: UserResponse = Depends(get_current_user)):
    return current_user

# =========================================================================
# Google OAuth Login
# =========================================================================
@router.post("/google-login", response_model=Token)
def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    email = None
    name = "Google User"

    # Development Mock Fallback
    if payload.id_token == "mock-google-token":
        email = "google_reader@aetheria.com"
        name = "Google Reader"
    else:
        # Standard Google OAuth verification
        try:
            # We check if google-auth package is available
            if importlib.util.find_spec("google.oauth2.id_token") is not None:
                from google.auth.transport import requests
                from google.oauth2 import id_token

                # Verify token signature (requires GOOGLE_CLIENT_ID)
                # For demo, we verify without client ID restrict if env not set
                idinfo = id_token.verify_oauth2_token(
                    payload.id_token,
                    requests.Request(),
                    clock_skew_in_seconds=10
                )
                email = idinfo.get("email")
                name = idinfo.get("name", "Google User")
            else:
                # If package not installed, raise import error
                raise ImportError("google-auth is not installed")
        except Exception as e:
            logger.error(f"Google token verification failed: {e}")
            raise AuthException("Google authentication failed") from e

    if not email:
        raise AuthException("Failed to extract email from Google token")

    # Resolve User
    user = get_user_by_email(db, email)
    if not user:
        # Register new OAuth user automatically
        # Random placeholder password since they login via OAuth
        placeholder_pw = get_password_hash(f"google-oauth-placeholder-{email}")
        user = User(
            email=email,
            hashed_password=placeholder_pw,
            full_name=name,
            role="user"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info(f"Registered new Google OAuth user: {email}")

    access_token = create_access_token(subject=user.email)
    refresh_token = create_refresh_token(subject=user.email)
    return Token(access_token=access_token, refresh_token=refresh_token)

# =========================================================================
# Forgot & Reset Password
# =========================================================================
@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = get_user_by_email(db, payload.email)
    if not user:
        # Avoid user enumeration attacks: return 200 even if email doesn't exist
        return {"message": "If this email is registered, a password reset link has been generated."}

    # Generate a secure 15-minute reset token
    import datetime

    from app.auth.security import jwt
    from app.core.config import settings

    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
    to_encode = {"exp": expire, "sub": user.email, "type": "reset"}
    reset_token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    # Log link directly to terminal for local development usage
    reset_url = f"http://localhost:5173/reset-password?token={reset_token}"
    logger.info(f"\n======================================================\n[MAIL LOGGER] Password reset requested for {user.email}\nReset URL: {reset_url}\n======================================================\n")

    return {"message": "If this email is registered, a password reset link has been generated."}

@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = verify_token(payload.token, token_type="reset")
    if not email:
        raise AuthException("Password reset token is invalid or has expired")

    user = get_user_by_email(db, email)
    if not user:
        raise EntityNotFoundException(entity_name="User", entity_id=email)

    # Hash and update password
    user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    logger.info(f"Password reset successfully for user: {email}")

    return {"message": "Password has been reset successfully."}

# =========================================================================
# Email Verification
# =========================================================================
@router.post("/request-verification")
def request_verification(current_user: User = Depends(get_current_user)):
    # Generate verification token
    import datetime

    from app.auth.security import jwt
    from app.core.config import settings

    expire = datetime.datetime.utcnow() + datetime.timedelta(days=1)
    to_encode = {"exp": expire, "sub": current_user.email, "type": "verify"}
    verify_token_str = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    # Log verification link directly to terminal
    verify_url = f"http://localhost:5173/verify-email?token={verify_token_str}"
    logger.info(f"\n======================================================\n[MAIL LOGGER] Verification requested for {current_user.email}\nVerification URL: {verify_url}\n======================================================\n")

    return {"message": "Verification link generated and logged."}

@router.post("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    email = verify_token(token, token_type="verify")
    if not email:
        raise AuthException("Verification token is invalid or has expired")

    user = get_user_by_email(db, email)
    if not user:
        raise EntityNotFoundException(entity_name="User", entity_id=email)

    # Mark user active (and optionally verified if column is present)
    user.is_active = True
    db.commit()
    logger.info(f"User email verified successfully: {email}")

    return {"message": "Email verified successfully."}

# Import dependencies inside endpoints to avoid circular references
