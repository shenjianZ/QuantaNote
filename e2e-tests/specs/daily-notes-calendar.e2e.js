import { cleanupAll, getAllItems } from "../helpers/commands.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";
import DocumentEditorPage from "../helpers/page-objects/DocumentEditorPage.js";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

describe("Daily notes calendar", () => {
  const today = localDateKey();

  before(async () => {
    await cleanupAll();
    await TopBar.navLibrary();
  });

  after(async () => {
    await cleanupAll();
  });

  it("opens the calendar and creates one tagged daily note for a date", async () => {
    await LibraryPage.openCalendar();
    await LibraryPage.selectCalendarDate(today);
    await LibraryPage.openSelectedDailyNote();

    await expect($(DocumentEditorPage.titleInput)).toBeDisplayed();
    await browser.waitUntil(
      async () => (await DocumentEditorPage.getTitle()).includes(today),
      { timeout: 5000, timeoutMsg: "Daily note title did not include the selected date" },
    );

    const items = await getAllItems();
    const dailyItems = items.filter((item) => item.content.includes(`daily_date: ${today}`));
    expect(dailyItems).toHaveLength(1);

    await DocumentEditorPage.clickBack();
    await TopBar.navLibrary();
    await LibraryPage.openCalendar();
    await LibraryPage.selectCalendarDate(today);
    await LibraryPage.openSelectedDailyNote();

    const itemsAfterReopen = await getAllItems();
    expect(itemsAfterReopen.filter((item) => item.content.includes(`daily_date: ${today}`))).toHaveLength(1);
  });
});
