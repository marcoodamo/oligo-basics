
import { test, expect } from '@playwright/test';

test('Admin can view orders and Vendor can edit drafts', async ({ page }) => {
    // 1. Admin Login and View Orders
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'marco_damo@hotmail.com');
    await page.fill('input[name="password"]', '123456');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/dashboard');

    await page.goto('http://localhost:3000/pedidos');
    await expect(page.locator('h1')).toContainText('Pedidos de Vendas');
    // Check if table exists
    await expect(page.locator('table')).toBeVisible();

    // Logout Admin
    await page.goto('http://localhost:3000/vendor/login'); // Should redirect or handle logout
    // Forcing logout via API would be cleaner, but let's try UI navigation if possible or just clear cookies context.
    // Since we are taking a shortcut, let's just use a new context or assuming the previous test left us in a clean state.
    // Actually, let's just use the vendor login page which should work even if logged in as user (different cookie).

    // 2. Vendor Login
    await page.goto('http://localhost:3000/vendor/login');
    await page.fill('input[name="email"]', 'test@vendor.com');
    await page.fill('input[name="password"]', 'oligo@teste1');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/vendor');

    // 3. Create Draft Order
    await page.click('a[href="/vendor/novo-pedido"]');
    await page.fill('input[name="customerOrderNumber"]', 'TEST-EDIT-001');
    await page.fill('input[name="orderDate"]', '2023-10-27');
    await page.fill('input[name="requestedDeliveryDate"]', '2023-11-01');

    // Fill Section 2
    await page.fill('input[name="customerName"]', 'Cliente Teste Edição');
    await page.fill('input[name="customerCnpj"]', '11.111.111/0001-11');

    // Fill Section 3
    await page.fill('input[name="billToStreet"]', 'Rua Teste');
    await page.fill('input[name="billToNumber"]', '123');
    await page.fill('input[name="billToDistrict"]', 'Bairro Teste');
    await page.fill('input[name="billToCity"]', 'Cidade Teste');
    await page.selectOption('select[name="billToState"]', 'SP');
    await page.fill('input[name="billToZip"]', '00000-000');

    // Fill Item
    await page.fill('input[value=""]', 'ITEM001'); // Item Number (first empty input in item row)
    // Needs better selectors for array inputs
    // Assuming first item
    const itemContainer = page.locator('.bg-gray-50').first();
    await itemContainer.locator('input').nth(0).fill('ITEM001'); // Item Number
    await itemContainer.locator('input').nth(1).fill('COD001'); // Product Code
    await itemContainer.locator('input').nth(2).fill('Produto Teste para Editar'); // Description
    await itemContainer.locator('input').nth(3).fill('10'); // Quantity
    await itemContainer.locator('select').first().selectOption('KG'); // UOM
    await itemContainer.locator('input').nth(4).fill('100'); // Unit Price

    // Fill Payment
    await page.fill('input[name="paymentTermDays"]', '30');

    // Fill Freight
    await page.selectOption('select[name="freightMode"]', 'CIF');

    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/vendor');

    // 4. Edit Draft
    // Find the order we just created
    const orderRow = page.locator('tr', { hasText: 'TEST-EDIT-001' });
    await expect(orderRow).toBeVisible();
    await expect(orderRow).toContainText('Rascunho');

    // Click Edit button (Pencil icon)
    await orderRow.locator('a[title="Editar"]').click();

    // Verify we are on edit page
    await expect(page.locator('h1')).toContainText('Editar Pedido');

    // Change Quantity
    await itemContainer.locator('input').nth(3).fill('20'); // Change quantity to 20

    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/vendor');

    // 5. Submit Order
    await orderRow.locator('button[title="Enviar"]').click();
    // Handle confirm dialog
    page.on('dialog', dialog => dialog.accept());

    // Wait for status change
    await expect(orderRow).toContainText('Enviado');

    // 6. Verify Edit Button is Gone
    await expect(orderRow.locator('a[title="Editar"]')).toBeHidden();
});
