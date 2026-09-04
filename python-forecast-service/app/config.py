from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    service_api_key: str
    model_timeout_seconds: int = 300

    model_config = SettingsConfigDict(env_file='.env', extra='ignore')


settings = Settings()
