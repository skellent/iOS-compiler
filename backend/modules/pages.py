from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

_jinja_env: Environment = Environment(
    loader=FileSystemLoader(Path(__file__).resolve().parent.parent / "templates" / "web"),
    autoescape=select_autoescape(["html", "xml"]),
)

class Pages:
    @staticmethod
    def Render(template: str, context: dict) -> str:
        return _jinja_env.get_template(f"{template}.html.j2").render(**context)
