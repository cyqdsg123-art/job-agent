"""DeepSeek 客户端封装（OpenAI 兼容接口）。"""
import json
from collections.abc import Iterator

from openai import OpenAI

from ..config import settings

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        if not settings.deepseek_api_key:
            raise RuntimeError(
                "未配置 DEEPSEEK_API_KEY：请复制 backend/.env.example 为 backend/.env 并填入 Key"
            )
        _client = OpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
        )
    return _client


def chat_json(system: str, user: str) -> dict:
    """JSON 模式调用：强制模型输出合法 JSON 并解析为 dict。"""
    resp = _get_client().chat.completions.create(
        model=settings.deepseek_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    return json.loads(resp.choices[0].message.content)


def chat_stream(system: str, user: str) -> Iterator[str]:
    """流式调用：逐 token 产出文本增量。"""
    stream = _get_client().chat.completions.create(
        model=settings.deepseek_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        stream=True,
        temperature=0.6,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if delta:
            yield delta
