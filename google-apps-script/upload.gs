// Google Apps Script — deploy as web app to receive typing test logs.
//
// Setup:
// 1. Go to https://script.google.com and create a new project
// 2. Paste this code
// 3. Replace FOLDER_ID with your Google Drive folder ID
//    (the alphanumeric string in the folder's URL)
// 4. Deploy → New deployment → Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy the deployment URL and pass it as ?driveUpload=URL

var FOLDER_ID = '1PlJqEqtJ-eNUWNv_2Xvjq3oDRPY-kH58';

function doGet(e) {
  try {
    var folder = DriveApp.getFolderById(FOLDER_ID);
    var filename = e.parameter.file;

    if (filename) {
      var files = folder.getFilesByName(filename);
      if (!files.hasNext()) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'error', message: 'File not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var content = files.next().getBlob().getDataAsString();
      return ContentService
        .createTextOutput(content)
        .setMimeType(ContentService.MimeType.JSON);
    }

    var allFiles = folder.getFiles();
    var list = [];
    while (allFiles.hasNext()) {
      var f = allFiles.next();
      list.push({ name: f.getName(), size: f.getSize(), created: f.getDateCreated().toISOString() });
    }
    list.sort(function(a, b) { return a.created > b.created ? -1 : 1; });

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', files: list }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var raw = e.parameter.payload || e.postData.contents;
    var body = JSON.parse(raw);
    var filename = body.filename || 'unknown.json';
    var data = JSON.stringify(body.data, null, 2);

    var folder = DriveApp.getFolderById(FOLDER_ID);
    folder.createFile(filename, data, 'application/json');

    return HtmlService.createHtmlOutput('<html><body>ok</body></html>');
  } catch (err) {
    return HtmlService.createHtmlOutput('<html><body>error: ' + err.toString() + '</body></html>');
  }
}
