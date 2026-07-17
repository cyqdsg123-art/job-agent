"""网页正文抓取：用户粘贴公开职位页 URL → 提取正文文本。

- 用 trafilatura 抽取正文（比裸 requests+正则可靠：自动去导航/页脚/广告）
- 基础 SSRF 防护：仅 http/https，拒绝内网/回环地址
- 登录墙/反爬页面（如 Boss 直聘详情页）抓不到正文时给出明确指引
"""
import ipaddress
import socket
from urllib.parse import urlparse


class FetchError(Exception):
    """抓取失败：原因直接展示给用户。"""


def _guard(url: str) -> None:
    """拒绝非 http(s) 与内网目标，防 SSRF。"""
    u = urlparse(url)
    if u.scheme not in ("http", "https"):
        raise FetchError("仅支持 http/https 链接")
    host = u.hostname or ""
    if not host:
        raise FetchError("链接格式不正确")
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        raise FetchError("域名无法解析，请检查链接")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            raise FetchError("不允许访问内网地址")


def fetch_page_text(url: str) -> str:
    """URL → 页面正文纯文本。失败抛 FetchError（含用户可读原因）。"""
    import trafilatura  # 延迟导入，加快后端启动

    _guard(url)
    html = trafilatura.fetch_url(url)
    if not html:
        raise FetchError(
            "页面抓取失败：该页面可能需要登录或有反爬（如 Boss 直聘详情页），请改用截图解析"
        )
    text = trafilatura.extract(html, include_comments=False) or ""
    if len(text.strip()) < 50:
        raise FetchError("未能提取到有效正文（可能是纯 JS 渲染页面），请改用截图解析")
    return text.strip()
