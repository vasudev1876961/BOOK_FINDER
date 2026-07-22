import { test, expect } from "@playwright/test";

test.describe("Aetheria E2E Platform Flow", () => {
  test("User should login, chat with the AI Librarian, and search books", async ({ page }) => {
    // 1. Visit Login page
    await page.goto("/login");
    await expect(page).toHaveTitle(/Aetheria/);

    // 2. Fill login form
    await page.fill('input[placeholder="name@example.com"]', "test@user.com");
    await page.fill('input[placeholder="••••••••"]', "testpassword123");
    
    // 3. Submit and wait for redirection
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    // 4. Assert dashboard details
    await expect(page.locator("h1")).toContainText("My Dashboard");
    await expect(page.locator("text=Reading Streak")).toBeVisible();

    // 5. Navigate to AI Librarian
    await page.click('text=AI Librarian');
    await page.waitForURL("/chat");
    await expect(page.locator("h1")).toContainText("AI Librarian");

    // 6. Send message to chatbot
    const chatInput = page.locator('input[placeholder="Ask the AI Librarian a question..."]');
    await chatInput.fill("Recommend a book for building long-term systems of success.");
    await page.click('button[type="submit"]');

    // Verify user bubble appeared
    await expect(page.locator("text=Recommend a book for building long-term systems of success.")).toBeVisible();
    
    // Verify bot response resolves (mock mode returns Atomic Habits)
    await expect(page.locator("text=Atomic Habits is a practical guide")).toBeVisible();

    // 7. Navigate to AI Search
    await page.click('text=AI Search');
    await page.waitForURL("/search");
    await expect(page.locator("h1")).toContainText("AI Book Discovery");

    // 8. Type search and select minimum rating
    await page.fill('input[placeholder="Search titles, authors, genres..."]', "Habits");
    await page.fill('input[type="range"]', "4.5"); // Rating filter
    
    // Assert results filter down
    await expect(page.locator("text=Atomic Habits")).toBeVisible();
  });
});
