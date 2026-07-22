
from app.core.logging import logger
from app.database.models import Review
from app.services.ai.llm_provider import llm_provider


class ReviewSentimentService:
    def analyze_reviews(self, book_title: str, reviews: list[Review]) -> str:
        """
        Synthesizes reviews into summarized pros, cons, and consensus.
        """
        if not reviews:
            return (
                "### Review Consensus\n"
                "No community reviews available yet. Be the first to share your thoughts!"
            )

        # Concatenate reviews text
        review_blocks = []
        for idx, r in enumerate(reviews):
            review_blocks.append(f"Review #{idx+1} (Rating: {r.rating}/5 stars):\n{r.review_text}")

        all_reviews_text = "\n\n---\n\n".join(review_blocks)

        system_prompt = (
            "You are an expert review compiler and brand analyst. "
            "Synthesize community reviews into a concise consensus report."
        )

        prompt = (
            f"Analyze the following community reviews for the book '{book_title}':\n\n"
            f"{all_reviews_text}\n\n"
            "Format the response strictly in Markdown with the following headings:\n"
            "### Review Consensus\n"
            "(A 2-3 sentence summary of the general community feeling towards this book)\n\n"
            "### Key Strengths (Praise)\n"
            "- **Strength 1**: ...\n"
            "- **Strength 2**: ...\n\n"
            "### Common Criticisms (Complaints)\n"
            "- **Criticism 1**: ...\n"
            "- **Criticism 2**: ..."
        )

        try:
            logger.info(f"Synthesizing sentiment for {len(reviews)} reviews of '{book_title}'")
            consensus = llm_provider.generate_text(prompt, system_prompt)
            return consensus
        except Exception as e:
            logger.error(f"Failed to synthesize review sentiment for '{book_title}': {e}")
            return "Failed to analyze review sentiment. Please check LLM provider logs."

# Singleton instance
review_sentiment_service = ReviewSentimentService()
