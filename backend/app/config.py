import os
from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    DEMO_MODE: bool = Field(default=True, description="When true, simulates AWS, Fabric, and external infrastructure.")
    APP_NAME: str = Field(default="ChainState – Cloud Infrastructure Security & Audit Platform")
    APP_ENV: str = Field(default="development")
    DEBUG: bool = Field(default=True)
    LOG_LEVEL: str = Field(default="INFO")

    # Database
    DATABASE_URL: str = Field(
        default="sqlite:///./chainstate.db",
        description="Database connection URL. SQLite default for instant zero-dependency local demo; PostgreSQL for prod."
    )

    # Security & JWT
    JWT_SECRET_KEY: str = Field(default="dev_secret_key_chainstate_9f82b81029482910482019482")
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=1440)

    # CORS
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173",
        description="Comma separated list of allowed CORS origins"
    )

    # AWS (Used when DEMO_MODE=False)
    AWS_REGION: str = Field(default="us-east-1")
    AWS_ACCESS_KEY_ID: Optional[str] = Field(default=None)
    AWS_SECRET_ACCESS_KEY: Optional[str] = Field(default=None)
    AWS_SESSION_TOKEN: Optional[str] = Field(default=None)

    # Hyperledger Fabric (Used when DEMO_MODE=False)
    FABRIC_CONNECTION_PROFILE_PATH: Optional[str] = Field(default=None)
    FABRIC_CERT_PATH: Optional[str] = Field(default=None)
    FABRIC_KEY_PATH: Optional[str] = Field(default=None)
    FABRIC_CHANNEL: str = Field(default="chainstate-channel")
    FABRIC_CHAINCODE: str = Field(default="audit_contract")
    FABRIC_MSP_ID: str = Field(default="Org1MSP")

    # Security & Tooling
    CHECKOV_ENABLED: bool = Field(default=True)
    TERRAFORM_BIN: str = Field(default="terraform")

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
