
import httpx

from app.core.config import settings
from app.core.logging import logger


class LlmProvider:
    def generate_text(self, prompt: str, system_prompt: str | None = None) -> str:
        raise NotImplementedError()


class MockLlmProvider(LlmProvider):
    """
    Returns realistic mocked responses for testing and demonstrations.
    """
    def generate_text(self, prompt: str, system_prompt: str | None = None) -> str:
        prompt_lower = prompt.lower()

        # 1. Book Comparisons
        if "compar" in prompt_lower or "vs" in prompt_lower:
            return (
                "### Comparison Summary\n"
                "Both books are masterpieces in the self-improvement and productivity space, but they address success from different angles.\n\n"
                "| Metric | Book A | Book B |\n"
                "| :--- | :--- | :--- |\n"
                "| **Core Focus** | Behavioral patterns and habit loops | Distraction-free deep cognitive focus |\n"
                "| **Approach** | Incremental micro-changes (1% better) | Major macro-shifts in environment and schedules |\n"
                "| **Difficulty** | Easy / Highly action-oriented | Medium / Requires lifestyle structural modifications |\n"
                "| **Best For** | Daily routine optimization | Professionals looking to create breakthrough work |\n\n"
                "### Strengths & Weaknesses\n"
                "- **Book A Strengths**: Highly practical, backed by biology/behavioral psychology, easy to start.\n"
                "- **Book B Strengths**: Crucial for high-depth knowledge workers, outlines deep intellectual structures.\n"
                "- **Verdict**: Read Book A to fix your daily routines, and Book B to structure your professional output."
            )

        # 2. Review Sentiment Synthesis
        elif "review" in prompt_lower or "sentiment" in prompt_lower or "consensus" in prompt_lower:
            return (
                "### Review Consensus\n"
                "The community has an overwhelmingly positive consensus towards this book, praising its high actionability and clear, structured lessons, though a few readers noted minor repetition.\n\n"
                "### Key Strengths (Praise)\n"
                "- **Highly Actionable**: Outlines clear steps and models (like the Four Laws).\n"
                "- **Engaging Writing Style**: Easily digestible with real-world examples.\n\n"
                "### Common Criticisms (Complaints)\n"
                "- **Minor Repetitions**: Some concepts are repeated across chapters.\n"
                "- **Pragmatic Focus**: Readers seeking deep academic proofs may find it too self-help oriented."
            )

        # 3. Book Summaries
        elif "summarize" in prompt_lower or "summary" in prompt_lower:
            if "atomic habits" in prompt_lower:
                return (
                    "### 1-Minute Elevator Pitch\n"
                    "Atomic Habits is a practical guide to self-improvement through tiny daily improvements. James Clear argues that dramatic life changes don't require massive overhauls, but rather the cumulative effect of small, 1% choices.\n\n"
                    "### Key Lessons\n"
                    "1. **Focus on Systems, Not Goals**: Your goals are about the results you want to achieve. Your systems are about the processes that lead to those results.\n"
                    "2. **Identity-Based Habits**: The key to building lasting habits is focusing on who you wish to become, not what you want to achieve.\n"
                    "3. **Four Laws of Behavior Change**: Make it Obvious, Make it Attractive, Make it Easy, and Make it Satisfying.\n\n"
                    "### Target Audience & Difficulty\n"
                    "- **Difficulty**: Easy / Pragmatic\n"
                    "- **Target Audience**: Anyone looking to optimize their daily routines, achieve productivity benchmarks, or break negative cycles."
                )
            elif "deep work" in prompt_lower:
                return (
                    "### 1-Minute Elevator Pitch\n"
                    "Deep Work explores the value of focused, distraction-free concentration in a hyper-connected world. Cal Newport argues that the ability to concentrate deeply is becoming increasingly rare and valuable.\n\n"
                    "### Key Lessons\n"
                    "1. **Monastic or Bimodal Scheduling**: Structure your time to escape distraction completely for blocks of hours or days.\n"
                    "2. **Embrace Boredom**: Practice resisting the urge to check notifications or seek instant cognitive stimuli.\n"
                    "3. **Quit Social Media**: Evaluate tools based on whether their benefits outweigh their distractions.\n\n"
                    "### Target Audience & Difficulty\n"
                    "- **Difficulty**: Medium\n"
                    "- **Target Audience**: Knowledge workers, programmers, writers, and students seeking to produce high-value output."
                )
            else:
                return (
                    "### 1-Minute Elevator Pitch\n"
                    "This is an insightful book that provides rich conceptual frameworks and highly actionable methodologies for personal and professional growth.\n\n"
                    "### Key Lessons\n"
                    "1. **Core Concept**: Small modifications yield compounding, massive results over prolonged horizons.\n"
                    "2. **Strategy**: Design environments to naturally prompt success.\n"
                    "3. **Execution**: Practice consistent, intentional steps rather than seeking singular massive achievements.\n\n"
                    "### Target Audience & Difficulty\n"
                    "- **Difficulty**: Accessible\n"
                    "- **Target Audience**: Readers interested in mastering this genre."
                )

        # 3. AI Librarian Chatbot
        elif "recommend" in prompt_lower or "i want" in prompt_lower or "looking for" in prompt_lower:
            return (
                "I would highly recommend checking out **Deep Work** by Cal Newport and **Atomic Habits** by James Clear. "
                "These books focus heavily on focus, productivity, and optimization. If you prefer high-intensity coding, "
                "**Clean Code** by Robert C. Martin provides practical exercises on software design structures."
            )

        # 4. Default RAG / Answering questions
        return (
            "Based on the provided book context, this book addresses the topic by emphasizing systematic execution. "
            "It suggests that success is not a singular event, but a direct outcome of daily routines and environment design. "
            "If you have further questions, feel free to ask about specific chapters!"
        )


class OpenAiLlmProvider(LlmProvider):
    """
    Connects to OpenAI Chat Completion API.
    """
    def __init__(self):
        from openai import OpenAI
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

    def generate_text(self, prompt: str, system_prompt: str | None = None) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.7,
                max_tokens=800
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI API call failed: {e}. Falling back to mock response.")
            return MockLlmProvider().generate_text(prompt, system_prompt)


class OllamaLlmProvider(LlmProvider):
    """
    Connects to locally running Ollama instance.
    """
    def generate_text(self, prompt: str, system_prompt: str | None = None) -> str:
        url = f"{settings.OLLAMA_HOST}/api/chat"

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": 0.7
            }
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    return data["message"]["content"]
                else:
                    logger.error(f"Ollama returned error: {response.text}")
                    return MockLlmProvider().generate_text(prompt, system_prompt)
        except Exception as e:
            logger.error(f"Ollama connection failed: {e}. Falling back to mock response.")
            return MockLlmProvider().generate_text(prompt, system_prompt)


# Factory initializer
def get_llm_provider() -> LlmProvider:
    if settings.LLM_PROVIDER == "openai" and settings.OPENAI_API_KEY:
        try:
            import importlib.util
            if importlib.util.find_spec("openai") is None:
                raise ImportError()
            return OpenAiLlmProvider()
        except ImportError:
            logger.warning("openai package not installed. Falling back to Mock.")

    elif settings.LLM_PROVIDER == "ollama":
        return OllamaLlmProvider()

    return MockLlmProvider()

llm_provider = get_llm_provider()
