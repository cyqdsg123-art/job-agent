"""SQLite 数据库：存储解析后的 JD 与匹配报告。"""
import os

from sqlmodel import Session, SQLModel, create_engine

DATA_DIR = os.environ.get("DATA_DIR", os.getcwd())
DB_PATH = os.path.join(DATA_DIR, "job_agent.db")

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
