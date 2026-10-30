import jwt
import pytest

from app.core.config import DEV_JWT_SECRET, Settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip() -> None:
    hashed = hash_password("super-secret-pass")

    assert hashed != "super-secret-pass"
    assert verify_password("super-secret-pass", hashed)
    assert not verify_password("wrong-pass", hashed)


def test_access_token_roundtrip() -> None:
    settings = Settings(jwt_secret="unit-test-secret")

    token = create_access_token(settings, subject="user-123")
    payload = decode_access_token(settings, token)

    assert payload["sub"] == "user-123"
    assert "exp" in payload


def test_access_token_rejects_wrong_secret() -> None:
    settings = Settings(jwt_secret="unit-test-secret")
    other = Settings(jwt_secret="different-secret")

    token = create_access_token(settings, subject="user-123")

    with pytest.raises(jwt.PyJWTError):
        decode_access_token(other, token)


@pytest.mark.parametrize("secret", [DEV_JWT_SECRET, "too-short"])
def test_production_refuses_a_weak_jwt_secret(secret: str) -> None:
    with pytest.raises(ValueError, match="JWT_SECRET"):
        Settings(app_env="production", jwt_secret=secret)


def test_production_accepts_a_random_jwt_secret() -> None:
    settings = Settings(app_env="production", jwt_secret="a" * 64)

    assert settings.app_env == "production"
