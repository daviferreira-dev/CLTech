import type { Locator } from "@playwright/test";

/** Escolhe uma opção do SelectMenu (combobox + listbox), que não é um <select> nativo. */
export async function chooseOption(combobox: Locator, option: string) {
  await combobox.click();
  await combobox.page().getByRole("option", { name: option, exact: true }).click();
}
