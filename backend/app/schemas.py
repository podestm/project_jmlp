from datetime import date, datetime
from pydantic import BaseModel
from typing import Optional


class RacerBase(BaseModel):
    name: Optional[str] = None  # firstName
    surname: str  # lastName
    sex: int
    year: int  # birthYear
    telefon: Optional[str] = None
    email: Optional[str] = None
    slcr_id: Optional[str] = None  # idSlcr
    club_id: Optional[int] = None


class RacerCreate(BaseModel):
    firstName: str  # Will be mapped to 'name' field
    lastName: str   # Will be mapped to 'surname' field
    sex: int
    birthYear: int  # Will be mapped to 'year' field
    club_id: Optional[int] = None
    idSlcr: Optional[str] = None  # Will be mapped to 'slcr_id' field


class Racer(RacerBase):
    id: int
    # Add computed fields for frontend compatibility
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    birthYear: Optional[int] = None
    idSlcr: Optional[str] = None
    club_name: Optional[str] = None

    class Config:
        from_attributes = True


class Club(BaseModel):
    id: int
    name: str
    valid: bool

    class Config:
        from_attributes = True


class ClubCreate(BaseModel):
    name: str


class Areal(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class ArealCreate(BaseModel):
    name: str


class Race(BaseModel):
    id: int
    closed: bool
    datum: Optional[date] = None
    raceNr: Optional[str] = None
    registration: bool
    proposition_file_id: Optional[int] = None
    results_file_id: Optional[int] = None
    areal_id: Optional[int] = None
    areal_name: Optional[str] = None
    organizer_id: Optional[int] = None
    organizer_name: Optional[str] = None
    raceCategory_id: int
    raceMethod_id: int
    raceType_id: int
    season_id: int

    class Config:
        from_attributes = True


class RegistrationCreate(BaseModel):
    race_id: int
    # Pro existujícího závodníka
    racer_id: Optional[int] = None
    # Pro nového závodníka
    racer_name: Optional[str] = None
    racer_surname: Optional[str] = None
    racer_sex: Optional[int] = None
    racer_year: Optional[int] = None
    racer_telefon: Optional[str] = None
    racer_email: Optional[str] = None
    racer_slcr_id: Optional[str] = None
    # Klub
    club_name: str


class Registration(BaseModel):
    id: int
    race_id: int
    racer_id: int
    registered_at: datetime

    class Config:
        from_attributes = True


# Post (aktuality) schemas
class PostBase(BaseModel):
    title: str
    content: str
    image_path: Optional[str] = None  # Legacy
    image_file_id: Optional[int] = None  # New approach
    image_position: Optional[str] = "right"  # "left", "right", "top", "none"
    document_file_id: Optional[int] = None
    published: bool = True


class PostCreate(PostBase):
    pass


class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    image_path: Optional[str] = None  # Legacy
    image_file_id: Optional[int] = None  # New approach
    image_position: Optional[str] = None  # "left", "right", "top", "none"
    document_file_id: Optional[int] = None
    published: Optional[bool] = None


class Post(PostBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Admin schemas
class AdminUserBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    is_active: bool = True


class AdminUserCreate(AdminUserBase):
    password: str


class AdminUser(AdminUserBase):
    id: int
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AdminLogin(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int


class TokenData(BaseModel):
    admin_id: Optional[int] = None


# File schemas
class FileBase(BaseModel):
    filename: str
    original_filename: str
    file_path: str
    file_size: int = 0
    mime_type: Optional[str] = None
    file_type: str = "document"  # 'document' or 'image'


class FileCreate(FileBase):
    uploaded_by: Optional[int] = None


class File(FileBase):
    id: int
    uploaded_at: datetime
    uploaded_by: Optional[int] = None

    class Config:
        from_attributes = True


# Race management schemas
class RaceCreate(BaseModel):
    datum: Optional[str] = None  # Changed from date to str - will be converted in backend
    raceNr: Optional[str] = None
    registration: bool = False
    proposition_file_id: Optional[int] = None
    results_file_id: Optional[int] = None
    areal_id: Optional[int] = None
    organizer_id: Optional[int] = None
    raceCategory_id: Optional[int] = 1  # Default value
    raceMethod_id: Optional[int] = 1    # Default value
    raceType_id: Optional[int] = 1      # Default value
    season_id: Optional[int] = None     # Will be auto-generated
    closed: bool = False


class RaceUpdate(BaseModel):
    datum: Optional[date] = None
    raceNr: Optional[str] = None
    registration: Optional[bool] = None
    proposition_file_id: Optional[int] = None
    results_file_id: Optional[int] = None
    areal_id: Optional[int] = None
    organizer_id: Optional[int] = None
    raceCategory_id: Optional[int] = None
    raceMethod_id: Optional[int] = None
    raceType_id: Optional[int] = None
    season_id: Optional[int] = None
    closed: Optional[bool] = None
