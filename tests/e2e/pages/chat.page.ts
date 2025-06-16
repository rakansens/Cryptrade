import { Page, Locator } from '@playwright/test';
import { TEST_SELECTORS } from '../types';

/**
 * Chat Page Object
 * Encapsulates all chat-related interactions
 */
export class ChatPageObject {
  readonly page: Page;
  readonly container: Locator;
  readonly input: Locator;
  readonly sendButton: Locator;
  readonly messages: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator(TEST_SELECTORS.chat.container);
    this.input = page.locator(TEST_SELECTORS.chat.input);
    this.sendButton = page.locator(TEST_SELECTORS.chat.sendButton);
    this.messages = page.locator(TEST_SELECTORS.chat.messages);
  }

  async open(): Promise<void> {
    // Check if chat is already open
    const isVisible = await this.container.isVisible();
    if (!isVisible) {
      // Click chat button to open
      const chatButton = await this.page.$('button:has(svg.lucide-message-square)');
      if (chatButton) {
        await chatButton.click();
      }
    }
    await this.container.waitFor({ state: 'visible', timeout: 5000 });
  }

  async sendMessage(message: string): Promise<void> {
    await this.input.fill(message);
    await this.sendButton.click();
    // Wait for message to be sent
    await this.page.waitForTimeout(500);
  }

  async waitForResponse(timeout: number = 30000): Promise<void> {
    // Wait for AI response indicator
    await this.page.waitForSelector('[data-testid="ai-message"]', { timeout });
  }

  async getLastMessage(): Promise<string> {
    const messages = await this.messages.locator('[data-testid="message"]').all();
    if (messages.length === 0) return '';
    
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return '';
    return await lastMessage.textContent() || '';
  }

  async hasProposal(): Promise<boolean> {
    return await this.page.locator(TEST_SELECTORS.chat.proposalCard).isVisible();
  }

  async approveProposal(): Promise<void> {
    const approveButton = this.page.locator('[data-testid="approve-proposal"]');
    await approveButton.click();
    // Wait for approval to process
    await this.page.waitForTimeout(1000);
  }

  async rejectProposal(): Promise<void> {
    const rejectButton = this.page.locator('[data-testid="reject-proposal"]');
    await rejectButton.click();
  }

  async getAllMessages(): Promise<string[]> {
    const messageElements = await this.messages.locator('[data-testid="message"]').all();
    const messages: string[] = [];
    
    for (const element of messageElements) {
      const text = await element.textContent();
      if (text) messages.push(text);
    }
    
    return messages;
  }

  async clearChat(): Promise<void> {
    // Implementation depends on UI - might need to reload or use a clear button
    const clearButton = this.page.locator('[data-testid="clear-chat"]');
    if (await clearButton.isVisible()) {
      await clearButton.click();
    }
  }
}