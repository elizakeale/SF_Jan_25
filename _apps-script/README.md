# Form setup (Google Sheet + email)

1. Open the Google Sheet > Extensions > Apps Script. Delete the sample code, paste in `Code.gs`, click the disk icon (Save).
2. In the toolbar function menu pick `testInquiry`, click Run, then Review permissions > choose the Google account > Advanced > Go to project > Allow.
   Check: a row appears on a new "Inquiries" tab and an email arrives at contact@studiofritz.co.
3. Deploy > New deployment > gear icon > Web app. Execute as: Me. Who has access: Anyone. Deploy. Copy the Web app URL (ends in /exec).
4. Paste that URL into `FORMS_ENDPOINT` at the top of the contactForms block in `js/main.js`, then push.

Changing the script later: Deploy > Manage deployments > pencil > Version: New version > Deploy. The URL stays the same.
