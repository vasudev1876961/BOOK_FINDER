from app.core.logging import logger
from app.database.models import Book
from app.services.ai.llm_provider import llm_provider


class BookComparisonService:
    def compare_books(self, book_a: Book, book_b: Book) -> str:
        """
        Generates a comparative analysis dossier between two books.
        """
        system_prompt = (
            "You are an expert academic advisor and book critic. "
            "Analyze the descriptions of two books and compile a highly structured side-by-side comparison."
        )

        prompt = (
            f"Please write a structured comparative analysis between:\n"
            f"Book A: '{book_a.title}' by {book_a.author.name if book_a.author else 'Unknown'}\n"
            f"Book A Description: {book_a.description or 'No description'}\n\n"
            f"Book B: '{book_b.title}' by {book_b.author.name if book_b.author else 'Unknown'}\n"
            f"Book B Description: {book_b.description or 'No description'}\n\n"
            "Format the response strictly in Markdown with the following headings:\n"
            "### Comparison Table\n"
            "(Create a Markdown table comparing: Core Theme, Tone/Style, Reading Difficulty (Scale 1-10), Primary Actionability, and Ideal Reading Time)\n\n"
            "### Core Philosophical Divergence\n"
            "(Explain in a paragraph how their core philosophies differ or complement each other)\n\n"
            "### Book A Strengths & Weaknesses\n"
            "- **Strengths**: ...\n"
            "- **Weaknesses**: ...\n\n"
            "### Book B Strengths & Weaknesses\n"
            "- **Strengths**: ...\n"
            "- **Weaknesses**: ...\n\n"
            "### Final Verdict\n"
            "(A summary recommendation explaining who should read Book A, who should read Book B, and in what order to read them)"
        )

        try:
            logger.info(f"Generating comparison between '{book_a.title}' and '{book_b.title}'")
            comparison = llm_provider.generate_text(prompt, system_prompt)
            return comparison
        except Exception as e:
            logger.error(f"Failed to compare books '{book_a.title}' and '{book_b.title}': {e}")
            return "Failed to generate AI comparison. Please check LLM provider logs."

# Singleton instance
book_comparison_service = BookComparisonService()
