import pypdfium2 as pdfium


def extract_text(content: bytes, content_type: str) -> str:
    if content_type == "application/pdf":
        pdf = pdfium.PdfDocument(content)
        texts: list[str] = []
        for page in pdf:
            textpage = page.get_textpage()
            texts.append(textpage.get_text_bounded())
            textpage.close()
            page.close()
        pdf.close()
        return "\n".join(texts)
    return content.decode("utf-8")
