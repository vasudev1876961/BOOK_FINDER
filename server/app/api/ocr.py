from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.auth.auth_service import get_current_user
from app.core.exceptions import AuthException
from app.schemas.user import UserResponse
from app.services.ocr.ocr_scanner import ocr_scanner_service

router = APIRouter(prefix="/ocr", tags=["OCR & ISBN Scanner"])


@router.post("/parse-cover")
async def parse_cover(
    file: UploadFile = File(...),
    left: int | None = Form(None),
    top: int | None = Form(None),
    right: int | None = Form(None),
    bottom: int | None = Form(None),
    rotate_angle: int | None = Form(None),
    binarize: bool = Form(False),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Upload a cover image to parse title and author text from it.
    Supports optional cropping box, rotation, and binarization.
    """
    content = await file.read()
    crop_box = (
        [left, top, right, bottom]
        if (left is not None and top is not None and right is not None and bottom is not None)
        else None
    )

    result = ocr_scanner_service.parse_cover_text(
        filename=file.filename,
        file_content=content,
        crop_box=crop_box,
        rotate_angle=rotate_angle,
        binarize=binarize
    )
    return result


@router.post("/scan-barcode")
async def scan_barcode(
    file: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Upload a barcode image to decode its ISBN and auto-fetch metadata from Open Library.
    """
    content = await file.read()
    isbn = ocr_scanner_service.scan_isbn_barcode(content)
    if not isbn:
        raise AuthException("Failed to decode ISBN from the barcode image.")

    details = ocr_scanner_service.fetch_open_library_details(isbn)
    if not details:
        return {
            "isbn": isbn,
            "message": "Barcode decoded successfully, but no details found in Open Library database.",
            "details": None
        }

    return {
        "isbn": isbn,
        "message": "Barcode decoded and metadata resolved successfully.",
        "details": details
    }
