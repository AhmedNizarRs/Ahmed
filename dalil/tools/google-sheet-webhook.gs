/**
 * DALIL sign-ups to Google Sheets.
 *
 * 1. Create a Google Sheet (for example "DALIL waitlist").
 * 2. Extensions > Apps Script. Replace the code with this file and save.
 * 3. Project Settings > Script properties > Add property: SECRET = the same long random text
 *    you set as SHEETS_WEBHOOK_SECRET in Netlify.
 * 4. Deploy > New deployment > type "Web app". Execute as: Me. Who has access: Anyone.
 *    Copy the web app URL into Netlify as SHEETS_WEBHOOK_URL.
 * Every new sign-up then appears as a row in the "Sign-ups" tab.
 */
var HEADERS = ["Received", "Name", "Email", "Phone or WhatsApp", "Organisation", "Interested in",
               "Investor type", "Ticket size", "Message", "Came from"];

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var secret = PropertiesService.getScriptProperties().getProperty("SECRET");
  if (!secret || data.secret !== secret) {
    return ContentService.createTextOutput("forbidden");
  }
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName("Sign-ups") || book.insertSheet("Sign-ups");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([new Date(data.received), data.name, data.email, data.phone, data.organisation,
                   data.interests, data.investorType, data.ticketSize, data.message, data.source]);
  return ContentService.createTextOutput("ok");
}
