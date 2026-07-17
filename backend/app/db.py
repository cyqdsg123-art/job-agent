"""SQLite 数据库：存储解析后的 JD 与匹配报告。"""
from sqlmodel import Session, SQLModel, create_engine

# 数据库文件生成在 backend/ 目录下
engine = create_engine(
    "sqlite:///job_agent.db",
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
