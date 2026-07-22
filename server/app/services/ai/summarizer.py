from app.core.logging import logger
from app.database.models import Book
from app.services.ai.llm_provider import llm_provider


class BookSummarizer:
    def generate_summary(self, book: Book) -> str:
        """
        Generates a structured AI summary dossier for a book based on its details.
        """
        if not book.description:
            return "No description available to summarize."

        system_prompt = (
            "You are an expert literary analyst and executive coach. "
            "Analyze the book description provided and generate a structured summary dossier."
        )

        prompt = (
            f"Please write a structured summary dossier for the book '{book.title}' by {book.author.name if book.author else 'Unknown'}.\n\n"
            f"Book Description:\n{book.description}\n\n"
            "Format the response strictly in Markdown with the following headings:\n"
            "### 1-Minute Elevator Pitch\n"
            "(A concise, punchy 3-4 sentence overview of the book's core premise and value)\n\n"
            "### Key Lessons\n"
            "(Numbered list of 3-4 most critical takeaways, lessons, or structural tools)\n\n"
            "### Writing Style & Complexity\n"
            "(A paragraph describing the author's voice, tone, and reading difficulty level)\n\n"
            "### Target Audience\n"
            "(Bullet points detailing exactly who would benefit most from reading this book)"
        )

        try:
            logger.info(f"Generating AI Summary for book: {book.title}")
            summary = llm_provider.generate_text(prompt, system_prompt)
            return summary
        except Exception as e:
            logger.error(f"Failed to generate summary for '{book.title}': {e}")
            return "Failed to generate AI summary. Please check LLM provider logs."

# Singleton instance
book_summarizer = BookSummarizer()
