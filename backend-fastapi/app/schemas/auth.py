from pydantic import BaseModel, ConfigDict, EmailStr, Field, ValidationInfo, field_validator, model_validator


def _validate_password(value: str) -> str:
    if len(value) < 10 or len(value) > 128:
        raise ValueError("Password must contain between 10 and 128 characters.")
    if not any(character.isalpha() for character in value) or not any(character.isdigit() for character in value):
        raise ValueError("Password must contain at least one letter and one number.")
    return value


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    password_confirmation: str = Field(min_length=10, max_length=128)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 2:
            raise ValueError("Name must contain at least 2 characters.")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password(value)

    @field_validator("password_confirmation")
    @classmethod
    def passwords_match(cls, value: str, info: ValidationInfo) -> str:
        if info.data.get("password") and value != info.data["password"]:
            raise ValueError("Password confirmation does not match.")
        return value


class EmailRequest(BaseModel):
    email: EmailStr


class VerifyEmailRequest(EmailRequest):
    otp: str = Field(pattern=r"^\d{6}$")


class LoginRequest(EmailRequest):
    password: str = Field(min_length=1, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)
    new_password_confirmation: str = Field(min_length=10, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password(value)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.new_password_confirmation:
            raise ValueError("Password confirmation does not match.")
        if self.current_password == self.new_password:
            raise ValueError("New password must be different from the current password.")
        return self


class RequestPasswordResetOTP(EmailRequest):
    pass


class ResetPasswordRequest(EmailRequest):
    otp: str = Field(pattern=r"^\d{6}$")
    new_password: str = Field(min_length=10, max_length=128)
    new_password_confirmation: str = Field(min_length=10, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password(value)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.new_password_confirmation:
            raise ValueError("Password confirmation does not match.")
        return self


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: str
    name: str
    email: str
    is_verified: bool
    keycloak_sub: str | None = None
    roles: list[str] = Field(default_factory=list)


class LoginResponse(BaseModel):
    expires_in: int
    user: UserResponse