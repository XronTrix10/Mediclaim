import logging
import uuid
from typing import Any, Dict, List, Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("mediclaim.exceptions")

class APIProblemException(Exception):
    """Exception conforming to RFC 9457 / RFC 7807 Problem Details."""

    def __init__(
        self,
        status_code: int,
        title: str,
        detail: str,
        code: str,
        problem_type: Optional[str] = None,
        errors: Optional[List[Dict[str, Any]]] = None,
        extra: Optional[Dict[str, Any]] = None,
    ):
        self.status_code = status_code
        self.title = title
        self.detail = detail
        self.code = code
        self.problem_type = problem_type or f"https://api.mediclaim.gov.in/problems/{code.lower().replace('_', '-')}"
        self.errors = errors or []
        self.extra = extra or {}
        super().__init__(detail)


def create_problem_response(
    status_code: int,
    title: str,
    detail: str,
    code: str,
    instance: str,
    request_id: Optional[str] = None,
    problem_type: Optional[str] = None,
    errors: Optional[List[Dict[str, Any]]] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> JSONResponse:
    content: Dict[str, Any] = {
        "type": problem_type or f"https://api.mediclaim.gov.in/problems/{code.lower().replace('_', '-')}",
        "title": title,
        "status": status_code,
        "detail": detail,
        "instance": instance,
        "code": code,
        "requestId": request_id or f"req_{uuid.uuid4().hex[:12]}",
        "errors": errors or [],
    }
    if extra:
        content.update(extra)

    return JSONResponse(
        status_code=status_code,
        content=content,
        media_type="application/problem+json",
    )


async def api_problem_exception_handler(request: Request, exc: APIProblemException) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return create_problem_response(
        status_code=exc.status_code,
        title=exc.title,
        detail=exc.detail,
        code=exc.code,
        instance=request.url.path,
        request_id=request_id,
        problem_type=exc.problem_type,
        errors=exc.errors,
        extra=exc.extra,
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    detail = exc.detail
    code = "HTTP_ERROR"
    title = "HTTP Error"
    extra = {}

    if isinstance(detail, dict):
        code = detail.get("code", "HTTP_ERROR")
        title = code.replace("_", " ").title()
        msg = detail.get("message", str(detail))
        extra = {k: v for k, v in detail.items() if k not in ("code", "message", "status")}
        detail = msg
    elif exc.status_code == status.HTTP_401_UNAUTHORIZED:
        code = "INVALID_CREDENTIALS"
        title = "Authentication Required"
    elif exc.status_code == status.HTTP_403_FORBIDDEN:
        code = "FORBIDDEN"
        title = "Access Forbidden"
    elif exc.status_code == status.HTTP_404_NOT_FOUND:
        code = "NOT_FOUND"
        title = "Resource Not Found"
    elif exc.status_code == status.HTTP_409_CONFLICT:
        code = "CONFLICT"
        title = "Resource Conflict"

    return create_problem_response(
        status_code=exc.status_code,
        title=title,
        detail=str(detail),
        code=code,
        instance=request.url.path,
        request_id=request_id,
        extra=extra,
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    formatted_errors = []
    for err in exc.errors():
        field = ".".join(str(loc) for loc in err.get("loc", []) if loc != "body")
        formatted_errors.append({
            "field": field,
            "message": err.get("msg", "Invalid value"),
            "type": err.get("type", "value_error"),
        })

    return create_problem_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        title="Validation Error",
        detail="Request payload failed schema validation.",
        code="VALIDATION_ERROR",
        instance=request.url.path,
        request_id=request_id,
        errors=formatted_errors,
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    logger.exception("Unhandled server exception: %s", exc)
    return create_problem_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        title="Internal Server Error",
        detail="An unexpected internal server error occurred. Please try again later.",
        code="INTERNAL_SERVER_ERROR",
        instance=request.url.path,
        request_id=request_id,
    )
