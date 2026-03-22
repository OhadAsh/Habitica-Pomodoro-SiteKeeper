const { test: base, chromium } = require('@playwright/test');
const path = require('path');
const { PopupPage } = require('./pages/PopupPage');

const pathToExtension = path.join(__dirname, '..', 'app');

exports.test = base.extend({
  /**
   * Chromium context with the extension loaded via --load-extension.
   * Worker-scoped so the browser is launched ONCE per worker and shared
   * across all tests in that worker (fast).
   */
  extensionContext: [
    async ({}, use) => {
      const ctx = await chromium.launchPersistentContext('', {
        headless: false,
        args: [
          `--disable-extensions-except=${pathToExtension}`,
          `--load-extension=${pathToExtension}`,
        ],
      });
      await use(ctx);
      await ctx.close();
    },
    { scope: 'worker' },
  ],

  /**
   * The extension ID assigned dynamically by Chromium, extracted from the
   * service worker URL. Prefer using popupUrl directly in tests.
   */
  extensionId: [
    async ({ extensionContext }, use) => {
      let [background] = extensionContext.serviceWorkers();
      if (!background) {
        background = await extensionContext.waitForEvent('serviceworker');
      }
      const extensionId = background.url().split('/')[2];
      await use(extensionId);
    },
    { scope: 'worker' },
  ],

  /** Full URL of the popup page. Use this in tests instead of building the URL manually. */
  popupUrl: [
    async ({ extensionId }, use) => {
      await use(`chrome-extension://${extensionId}/popup/popup.html`);
    },
    { scope: 'worker' },
  ],

  /**
   * A ready-to-use PopupPage instance backed by a fresh page.
   *
   * Opens the popup, waits for its async initialisation to complete (the
   * "loading" class is removed from <body> once background data is fetched),
   * and closes the page automatically after each test. Tests never need to
   * call openPopup() or page.close() themselves.
   */
  popupPage: async ({ extensionContext, popupUrl }, use) => {
    const page = await extensionContext.newPage();
    await page.goto(popupUrl);
    await page.waitForFunction(
      () => !document.body.classList.contains('loading'),
      { timeout: 15_000 },
    );
    await use(new PopupPage(page));
    await page.close();
  },
});

exports.expect = base.expect;
