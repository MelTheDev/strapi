import { test, expect } from '@playwright/test';
import { login } from '../../../utils/login';
import { resetDatabaseAndImportDataFromPath } from '../../../utils/dts-import';
import { findAndClose } from '../../../utils/shared';
import { EDITOR_EMAIL_ADDRESS, EDITOR_PASSWORD } from '../../../constants';

test.describe('Edit View', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabaseAndImportDataFromPath('with-admin.tar');
    await page.goto('/admin');
    await login({ page });
  });

  test.describe('Collection Type', () => {
    const CREATE_URL =
      /\/admin\/content-manager\/collection-types\/api::article.article\/create(\?.*)?/;
    const LIST_URL = /\/admin\/content-manager\/collection-types\/api::article.article(\?.*)?/;

    // TODO: Skip this test for now since there is a known bug with the draft relations check
    test.fixme(
      'as a user I want to be warned if I try to publish content that has draft relations',
      async ({ page }) => {
        await page.getByLabel('Content Manager').click();
        await page.getByRole('link', { name: 'Create new entry' }).click();

        // Wait for the URL to match the CREATE_URL pattern
        await page.waitForURL(CREATE_URL);

        // Add a new relation to the entry
        await page.getByRole('combobox', { name: 'authors' }).click();
        await page.getByLabel('Coach BeardDraft').click();
        // Attempt to publish the entry
        await page.getByRole('button', { name: 'Publish' }).click();

        // Verify that a warning about a single draft relation is displayed
        await expect(page.getByText('This entry is related to 1')).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();

        // Save the current state of the entry
        await page.getByRole('button', { name: 'Save' }).click();
        await findAndClose(page, 'Saved Document');

        // Add another relation to the entry
        await page.getByRole('combobox', { name: 'authors' }).click();
        await page.getByLabel('Led TassoDraft').click();
        // Attempt to publish the entry again
        await page.getByRole('button', { name: 'Publish' }).click();

        // Verify that a warning about two draft relations is displayed
        await expect(page.getByText('This entry is related to 2')).toBeVisible();
        await page.getByRole('button', { name: 'Cancel' }).click();

        // Save the current state of the entry
        await page.getByRole('button', { name: 'Save' }).click();
        await findAndClose(page, 'Saved Document');

        // Attempt to publish the entry once more
        await page.getByRole('button', { name: 'Publish' }).click();

        // Verify that the warning about three draft relations is still displayed
        await expect(page.getByText('This entry is related to 3')).toBeVisible();
      }
    );

    test('as a user without read permission for a required field, I should see an error when trying to publish', async ({
      page,
    }) => {
      // As super admin create a new draft product entry
      await page.getByLabel('Content Manager').click();
      await page.getByRole('link', { name: 'Products' }).click();
      await page.getByRole('link', { name: 'Create new entry' }).click();

      const slug = 'product-for-required-test';
      await page.getByLabel('slug*This value is unique for').fill(slug);

      await page.getByRole('button', { name: 'Save' }).click();
      await findAndClose(page, 'Saved Document');

      // As super admin remove read permission for the name field for the Editor role
      await page.getByLabel('Settings').click();
      await page.getByRole('link', { name: 'Roles' }).first().click();
      await page.getByText('Editor', { exact: true }).click();

      await page.getByLabel('Select all Product permissions').click();
      await page.getByRole('button', { name: 'Product' }).click();
      await page.getByLabel('Select name Read permission').click();

      await page.getByRole('button', { name: 'Save' }).click();
      await findAndClose(page, 'Saved');

      await page.getByRole('button', { name: 'test testing' }).click();
      await page.getByRole('menuitem', { name: 'Log out' }).click();

      // As editor login and try to publish the entry
      await login({ page, username: EDITOR_EMAIL_ADDRESS, password: EDITOR_PASSWORD });

      await page.getByLabel('Content Manager').click();
      await page.getByRole('link', { name: 'Products' }).click();
      await page.getByText(slug).click();
      await page.getByRole('button', { name: 'Publish' }).click();

      await expect(
        page.getByText(
          'Your current permissions prevent access to certain required fields. Please request access from an administrator to proceed.'
        )
      ).toBeVisible();
    });

    test('as a user I want to create and publish a document at the same time, then modify and save that document.', async ({
      page,
    }) => {
      await page.getByRole('link', { name: 'Content Manager' }).click();
      await page.getByRole('link', { name: /Create new entry/ }).click();

      /**
       * Now we're in the edit view.
       */
      await page.waitForURL(CREATE_URL);

      await expect(page.getByRole('heading', { name: 'Create an entry' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'More actions' })).not.toBeDisabled();

      /**
       * There should be two tabs, draft and published.
       * The draft tab should be active by default.
       * The published tab should be disabled.
       */
      await expect(page.getByRole('tab', { name: 'Draft' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Published' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Draft' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(page.getByRole('tab', { name: 'Published' })).toHaveAttribute(
        'aria-selected',
        'false'
      );
      await expect(page.getByRole('tab', { name: 'Draft' })).not.toBeDisabled();
      await expect(page.getByRole('tab', { name: 'Published' })).toBeDisabled();

      /**
       * Both the publish & save button should be enabled only after we start filling in the form
       * and it should disable itself after we save the entry. The publish button should still be enabled.
       */
      await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'More document actions' })).toBeDisabled();
      await page.getByRole('textbox', { name: 'title' }).fill('Being from Kansas City');

      await page.getByRole('button', { name: 'Publish' }).click();
      await findAndClose(page, 'Published Document');

      /**
       * When we click publish, we should stay on the draft tab but check the published tab to ensure
       * all the actions are disabled, going back to the draft tab will tell us what actions are then
       * available.
       */
      await expect(page.getByRole('tab', { name: 'Draft' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(page.getByRole('tab', { name: 'Published' })).toHaveAttribute(
        'aria-selected',
        'false'
      );
      await expect(page.getByRole('tab', { name: 'Published' })).toBeEnabled();
      await page.getByRole('tab', { name: 'Published' }).click();
      await expect(page.getByRole('tab', { name: 'Draft' })).toHaveAttribute(
        'aria-selected',
        'false'
      );
      await expect(page.getByRole('tab', { name: 'Published' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled();

      await page.getByRole('tab', { name: 'Draft' }).click();
      await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'More document actions' })).not.toBeDisabled();

      await page.getByRole('button', { name: 'More document actions' }).click();
      await expect(
        page.getByRole('menuitem', { name: 'Unpublish', exact: true })
      ).not.toBeDisabled();
      await expect(page.getByRole('menuitem', { name: 'Discard changes' })).toBeDisabled();
      await page.keyboard.press('Escape'); // close the menu since we're not actioning on it atm.

      /**
       * Now we go back to the list view to confirm our new entry has been correctly added to the database.
       */
      await page.getByRole('link', { name: 'Content Manager' }).click();
      await page.waitForURL(LIST_URL);
      await expect(page.getByRole('gridcell', { name: 'Being from Kansas City' })).toBeVisible();
      await page.getByRole('gridcell', { name: 'Being from Kansas City' }).click();

      await page.getByRole('combobox', { name: 'authors' }).click();
      const draft = page
        .locator('role=option')
        .filter({ hasText: 'Led Tasso' })
        .filter({ hasText: 'Draft' });

      await expect(draft).toBeEnabled();
      await draft.click();

      await expect(page.getByRole('button', { name: 'Led Tasso' })).toBeVisible();

      await page.getByRole('button', { name: 'Save' }).click();
      await findAndClose(page, 'Saved Document');

      await expect(page.getByText('Modified')).toBeVisible();
    });

    test('as a user I want to create a document, then modify that document', async ({ page }) => {
      await page.getByRole('link', { name: 'Content Manager' }).click();
      await page.getByRole('link', { name: /Create new entry/ }).click();

      /**
       * Now we're in the edit view.
       */
      await page.waitForURL(CREATE_URL);

      await expect(page.getByRole('heading', { name: 'Create an entry' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'More actions' })).not.toBeDisabled();

      /**
       * There should be two tabs, draft and published.
       * The draft tab should be active by default.
       * The published tab should be disabled.
       */
      await expect(page.getByRole('tab', { name: 'Draft' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Published' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Draft' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(page.getByRole('tab', { name: 'Published' })).toHaveAttribute(
        'aria-selected',
        'false'
      );
      await expect(page.getByRole('tab', { name: 'Draft' })).not.toBeDisabled();
      await expect(page.getByRole('tab', { name: 'Published' })).toBeDisabled();

      /**
       * Both the publish & save button should be enabled only after we start filling in the form
       * and it should disable itself after we save the entry. The publish button should still be enabled.
       */
      await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'More document actions' })).toBeDisabled();
      await page.getByRole('textbox', { name: 'title' }).fill('Being from Kansas City');

      await page.getByRole('button', { name: 'Save' }).click();
      await findAndClose(page, 'Saved Document');

      await expect(page.getByRole('tab', { name: 'Draft' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(page.getByRole('tab', { name: 'Published' })).toHaveAttribute(
        'aria-selected',
        'false'
      );
      await expect(page.getByRole('tab', { name: 'Draft' })).toBeEnabled();
      await expect(page.getByRole('tab', { name: 'Published' })).toBeDisabled();

      // the title should update post save because it's the `mainField` of the content-type
      await expect(page.getByRole('heading', { name: 'Being from Kansas City' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Create an entry' })).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Publish' })).not.toBeDisabled();

      await page.getByRole('textbox', { name: 'title' }).fill('Being an American');
      await page
        .getByRole('textbox')
        .nth(2)
        .fill('I miss the denver broncos, now I can only watch it on the evening.');

      await page.getByRole('combobox', { name: 'authors' }).click();

      const draft = page
        .locator('role=option')
        .filter({ hasText: 'Led Tasso' })
        .filter({ hasText: 'Draft' });

      await expect(draft).toBeEnabled();
      await draft.click();

      await expect(page.getByRole('button', { name: 'Led Tasso' })).toBeVisible();

      await expect(page.getByRole('button', { name: 'Save' })).not.toBeDisabled();

      await page.getByRole('button', { name: 'Save' }).click();
      await findAndClose(page, 'Saved Document');

      // Check that we can save with keyboard shortcuts
      await page.getByRole('textbox', { name: 'title' }).fill('Being an American...');
      await page.keyboard.press('Control+Enter');
      await findAndClose(page, 'Saved Document');

      await expect(page.getByRole('tab', { name: 'Draft' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(page.getByRole('tab', { name: 'Published' })).toHaveAttribute(
        'aria-selected',
        'false'
      );
      await expect(page.getByRole('tab', { name: 'Draft' })).toBeEnabled();
      await expect(page.getByRole('tab', { name: 'Published' })).toBeDisabled();
      await expect(page.getByText('Modified')).not.toBeVisible();

      /**
       * Now we go back to the list view to confirm our new entry has been correctly added to the database.
       */
      await page.getByRole('link', { name: 'Content Manager' }).click();
      await page.waitForURL(LIST_URL);
      await expect(page.getByRole('gridcell', { name: 'Being an American' })).toBeVisible();
      await page.getByRole('gridcell', { name: 'Being an American' }).click();

      await expect(page.getByRole('heading', { name: 'Being an American' })).toBeVisible();
    });

    test('as a user I want to be able to discard my changes', async ({ page }) => {
      await page.getByRole('link', { name: 'Content Manager' }).click();
      await page.getByRole('gridcell', { name: 'West Ham post match analysis' }).click();

      await page.getByRole('button', { name: 'Publish' }).click();

      await findAndClose(page, 'Published Document');

      await page.getByRole('button', { name: 'More document actions' }).click();
      await expect(page.getByRole('menuitem', { name: 'Discard changes' })).toBeDisabled();
      await page.keyboard.press('Escape'); // close the menu since we're not actioning on it atm.

      await page.getByRole('textbox', { name: 'title' }).fill('West Ham vs Richmond AFC');
      await page.getByRole('button', { name: 'Save' }).click();

      await findAndClose(page, 'Saved Document');

      await page.getByRole('button', { name: 'More document actions' }).click();
      await expect(page.getByRole('menuitem', { name: 'Discard changes' })).not.toBeDisabled();

      await page.getByRole('menuitem', { name: 'Discard changes' }).click();
      await page.getByRole('button', { name: 'Confirm' }).click();

      await findAndClose(page, 'Changes discarded');
    });

    test('as a user I want to unpublish a document', async ({ page }) => {
      await page.getByRole('link', { name: 'Content Manager' }).click();
      await page.getByRole('gridcell', { name: 'West Ham post match analysis' }).click();

      await expect(page.getByRole('tab', { name: 'Draft' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Published' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Draft' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(page.getByRole('tab', { name: 'Published' })).toHaveAttribute(
        'aria-selected',
        'false'
      );
      await expect(page.getByRole('tab', { name: 'Draft' })).not.toBeDisabled();

      await page.getByRole('button', { name: 'Publish' }).click();
      await findAndClose(page, 'Published Document');

      await expect(page.getByRole('tab', { name: 'Draft' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Published' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Draft' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(page.getByRole('tab', { name: 'Published' })).toHaveAttribute(
        'aria-selected',
        'false'
      );
      await expect(page.getByRole('tab', { name: 'Draft' })).not.toBeDisabled();
      await expect(page.getByRole('tab', { name: 'Published' })).not.toBeDisabled();

      await page.getByRole('button', { name: 'More document actions' }).click();
      await expect(
        page.getByRole('menuitem', { name: 'Unpublish', exact: true })
      ).not.toBeDisabled();
      await page.getByRole('menuitem', { name: 'Unpublish', exact: true }).click();

      await findAndClose(page, 'Unpublished Document');

      await expect(page.getByRole('tab', { name: 'Draft' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Published' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Draft' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(page.getByRole('tab', { name: 'Published' })).toHaveAttribute(
        'aria-selected',
        'false'
      );
      await expect(page.getByRole('tab', { name: 'Draft' })).not.toBeDisabled();
      await expect(page.getByRole('tab', { name: 'Published' })).toBeDisabled();
    });

    test('as a user I want to delete a document', async ({ page }) => {
      await page.getByRole('link', { name: 'Content Manager' }).click();
      await page.getByRole('gridcell', { name: 'West Ham post match analysis' }).click();

      await page.getByRole('button', { name: 'More actions' }).click();
      await page.getByRole('menuitem', { name: 'Delete entry (all locales)' }).click();
      await page.getByRole('button', { name: 'Confirm' }).click();

      await findAndClose(page, 'Deleted Document');

      /**
       * We're back on the list view and we can asser the document was correctly deleted.
       */
      await page.waitForURL(LIST_URL);
      await expect(
        page.getByRole('gridcell', { name: 'West Ham post match analysis' })
      ).not.toBeVisible();
    });
  });
});
