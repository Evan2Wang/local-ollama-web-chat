def title_from_content(content: str) -> str:
    one_line = " ".join(content.strip().split())
    return (one_line[:20] or "新会话") + ("..." if len(one_line) > 20 else "")
