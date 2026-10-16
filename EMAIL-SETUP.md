# Switching on the results emails (EmailJS – free)

The tests email the results to the student (or parent) **and** to the school automatically.
Sending goes through **EmailJS** (free plan: 200 emails a month). It sends from the school's own Outlook
account, so there is no password in the code. The only settings are three public ids in **`app/config.json`**.

Until the ids are filled in, the results are still saved, and the results page says
"Email sending is not switched on yet". There is a Retry button.

## One-time setup (about 10 minutes)
1. Go to <https://www.emailjs.com> and **Sign Up** (free). Confirm the activation email.
2. **Email Services → Add New Service → Outlook 365**. Click **Connect Account** and sign in with
   **london-english@live.com**. Allow access, then **Create Service**. Copy the **Service ID** (e.g. `service_ab12cd3`).
   *(If Outlook will not connect, choose **Gmail** and use a school Gmail account instead.)*
3. **Email Templates → Create New Template**:
   - *Settings* tab:
     - **To Email:** `{{to_email}}`
     - **Bcc:** `{{bcc_email}}`
     - **Reply To:** `{{reply_to}}`
     - **From Name:** `London Centre of English`
     - **Subject:** `{{subject}}`
   - *Content*: click **Edit Content → Code Editor**, delete everything and type exactly: `{{{report_html}}}`
     (three curly brackets on each side).
   - **Save**. Copy the **Template ID** (e.g. `template_xy98zz1`).
4. **Account → General**: copy the **Public Key**.
   **Account → Security**: tick **"Allow EmailJS API for non-browser applications"** and save. The Windows app needs this.
5. On GitHub open `app/config.json` → ✏️ **Edit**. Replace the three `YOUR_…` values with the ids:
   ```json
   "emailjs": { "serviceId": "service_ab12cd3", "templateId": "template_xy98zz1", "publicKey": "AbCdEf123456" }
   ```
   Then **Commit changes**. About one minute later the website is updated. The installed Windows app also reads this live
   file (`https://rich59.github.io/london-centre-tests/config.json`) every time it sends, so **no reinstall is needed**.
6. Test: do any test with your own email address and press Finish. The page should say **"Results emailed ✓"**.

## Notes
- One email per test result: To = the student/parent, Bcc = the school (`schoolEmail` in config.json).
  To send the copy as CC instead, put `{{bcc_email}}` in the template's CC field.
- The free plan allows 200 emails/month and adds a small "sent via EmailJS" line.
- The results are always saved first, so nothing is lost when the email fails:
  - Windows app: `Documents\London Centre Tests\Results\<date>_<name>_<test>\` (report.pdf, report.html, results.json, report.txt)
  - Browser: a downloaded `Results_….html` file
- If a send fails (no internet, wrong id), the results page shows the reason and a **Retry** button.
