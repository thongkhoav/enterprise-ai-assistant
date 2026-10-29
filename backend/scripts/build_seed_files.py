"""Build the bundled PDF and DOCX sample documents from the text below.

The generated files are committed, so this only needs to run after editing the text:

    uv run --with reportlab python scripts/build_seed_files.py

PDFs get one section group per page so answers can cite page numbers. The security
whitepaper goes to docs/demo_upload/ and is not seeded: it is the file to drag into the chat
when demoing upload ("I don't know" before, a cited answer after).
"""

from pathlib import Path

from docx import Document
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

ROOT = Path(__file__).resolve().parents[1]

# Each document: title, subtitle, then pages; each page is a list of (heading, paragraphs).
MSA = {
    "title": "Acme Master Service Agreement",
    "subtitle": "Version 4.2, effective January 1, 2026",
    "pages": [
        [
            (
                "1. Scope",
                [
                    "This Master Service Agreement (the Agreement) governs access to the Acme "
                    "platform by the customer named on the Order Form. It applies to the Starter, "
                    "Premium and Strategic plans. Where an Order Form and this Agreement conflict, "
                    "the Order Form controls for that order only.",
                    "Acme provides the subscribed services, standard support for the purchased "
                    "plan, and the documentation published at docs.acme.example. Professional "
                    "services such as custom integrations are ordered separately under a "
                    "statement of work.",
                ],
            ),
            (
                "2. Term and Renewal",
                [
                    "The initial subscription term is 12 months from the start date on the Order "
                    "Form, unless the Order Form states a multi-year term. Strategic plans may be "
                    "signed for 24 or 36 months.",
                    "Subscriptions renew automatically for successive 12-month terms unless either "
                    "party gives written notice of non-renewal at least 60 days before the end of "
                    "the current term. Notice sent by email to legal@acme.example is sufficient.",
                    "Acme may increase fees at renewal by no more than 7 percent over the prior "
                    "term, and must give at least 90 days written notice of any increase.",
                ],
            ),
        ],
        [
            (
                "3. Fees and Payment",
                [
                    "Subscription fees are invoiced annually in advance. Invoices are payable "
                    "within 30 days of the invoice date (net 30). Fees are stated in USD and "
                    "exclude taxes, which the customer pays unless it provides a valid exemption "
                    "certificate.",
                    "Overdue amounts accrue interest of 1.5 percent per month or the maximum rate "
                    "allowed by law, whichever is lower. If an invoice is more than 30 days "
                    "overdue, Acme may suspend the services after giving 15 days written notice. "
                    "Suspension does not change the customer's payment obligations.",
                    "The customer must dispute an invoice in good faith within 20 days of "
                    "receiving it. Undisputed portions remain payable on the original due date. "
                    "Usage above the plan allowance is billed monthly in arrears at the overage "
                    "rates in the current price list.",
                ],
            ),
        ],
        [
            (
                "4. Service Level Agreement",
                [
                    "Acme commits to monthly uptime of 99.9 percent for the Premium plan and "
                    "99.95 percent for the Strategic plan. The Starter plan has no uptime "
                    "commitment. Uptime is measured per calendar month by Acme's external "
                    "monitoring of the production API and web application.",
                    "Scheduled maintenance is excluded from downtime. Maintenance runs on Sundays "
                    "between 02:00 and 04:00 UTC and is announced at least 72 hours in advance on "
                    "status.acme.example. Downtime caused by the customer, force majeure or "
                    "third-party networks outside Acme's control is also excluded.",
                    "If monthly uptime falls below the commitment, the customer receives a service "
                    "credit on its next invoice according to these tiers.",
                ],
            ),
            (
                "",
                [
                    "Uptime from 99.0 percent up to the commitment earns a credit of 10 percent "
                    "of the monthly fee.",
                    "Uptime from 95.0 percent up to 99.0 percent earns a credit of 25 percent of "
                    "the monthly fee.",
                    "Uptime below 95.0 percent earns a credit of 50 percent of the monthly fee.",
                ],
            ),
            (
                "",
                [
                    "Service credits are capped at 50 percent of the monthly fee for the affected "
                    "month. The customer must request a credit within 30 days after the end of the "
                    "affected month. Service credits are the customer's sole remedy for missing "
                    "the uptime commitment.",
                ],
            ),
        ],
        [
            (
                "5. Data Protection",
                [
                    "The customer owns all customer data. Acme processes customer data only to "
                    "provide the services and as described in the Data Processing Addendum.",
                    "Customer data is hosted in the region selected on the Order Form: United "
                    "States (AWS us-east-1) or European Union (AWS eu-central-1). Acme does not "
                    "move customer data out of the selected region except at the customer's "
                    "written request.",
                    "Acme notifies the customer of a confirmed security breach affecting customer "
                    "data within 48 hours of confirming it. Acme gives at least 30 days notice "
                    "before adding a new subprocessor, and the customer may object in writing "
                    "during that period.",
                    "After the Agreement ends, the customer may export its data for 30 days. Acme "
                    "deletes remaining customer data within 30 days after the export window "
                    "closes, except where law requires longer retention.",
                ],
            ),
        ],
        [
            (
                "6. Termination",
                [
                    "Either party may terminate the Agreement for material breach if the breach is "
                    "not cured within 30 days of written notice. If the customer terminates "
                    "because of Acme's uncured breach, Acme refunds prepaid fees for the remaining "
                    "term on a pro rata basis. Otherwise, fees paid are non-refundable.",
                ],
            ),
            (
                "7. Limitation of Liability",
                [
                    "Each party's total liability under the Agreement is limited to the fees paid "
                    "or payable by the customer in the 12 months before the event giving rise to "
                    "the claim. For breaches of the data protection section, the cap is two times "
                    "those fees. Neither party is liable for indirect or consequential damages, "
                    "including lost profits.",
                    "The caps do not apply to a party's indemnification obligations, to breach of "
                    "confidentiality, or to the customer's obligation to pay fees.",
                ],
            ),
            (
                "8. Governing Law",
                [
                    "The Agreement is governed by the laws of the State of Delaware, without "
                    "regard to conflict of laws rules. Disputes are resolved in the state or "
                    "federal courts located in Wilmington, Delaware.",
                ],
            ),
        ],
    ],
}

HANDBOOK = {
    "title": "Acme Employee Handbook",
    "subtitle": "2026 edition, People Operations",
    "pages": [
        [
            (
                "Welcome",
                [
                    "This handbook explains how we work at Acme. It applies to all full-time "
                    "employees. Country addenda add local rules where the law requires them, and "
                    "the addendum wins if it differs from this handbook.",
                ],
            ),
            (
                "Working Hours and Location",
                [
                    "Acme core hours are 10:00 to 15:00 in your local time zone. Outside core "
                    "hours you choose your schedule, as long as your team agrees on response "
                    "times for urgent work.",
                    "Office-based employees work from the office on Tuesdays and Thursdays and "
                    "may work remotely on the other days. Fully remote roles must be approved by "
                    "the department VP and are listed as remote in the job description.",
                    "Working from another country for more than 14 days in a calendar year needs "
                    "approval from People Operations, because it can create tax obligations.",
                ],
            ),
        ],
        [
            (
                "Paid Time Off",
                [
                    "Full-time employees receive 20 days of paid time off (PTO) per year. PTO "
                    "increases by one day for each completed year of service, up to 25 days. "
                    "Public holidays follow the calendar of the country you are employed in and "
                    "do not count against PTO.",
                    "Request PTO in Workday. Absences of three days or more should be requested "
                    "at least two weeks in advance. Up to 5 unused PTO days carry over to the next "
                    "year and expire on March 31.",
                ],
            ),
            (
                "Sick Days",
                [
                    "Employees receive 10 paid sick days per year. Tell your manager as early as "
                    "possible on the first day you are sick. A doctor's note is required after "
                    "three consecutive sick days.",
                    "Other leave types, such as bereavement or jury duty, are described in the "
                    "country addenda.",
                ],
            ),
        ],
        [
            (
                "Expenses",
                [
                    "Submit expenses in Expensify within 30 days of the purchase. Attach a receipt "
                    "for every expense above 25 USD. Expenses submitted after 60 days are not "
                    "reimbursed without VP approval.",
                    "Meals while travelling are reimbursed up to 75 USD per day for domestic "
                    "trips and 100 USD per day for international trips. Alcohol is not "
                    "reimbursed unless it is part of an approved customer dinner.",
                ],
            ),
            (
                "Business Travel",
                [
                    "All business trips need manager approval before booking. Book flights and "
                    "hotels through Navan at least 14 days before departure when possible.",
                    "Book economy class for flights under 6 hours and premium economy for flights "
                    "of 6 hours or longer. Hotels are capped at 250 USD per night, or 400 USD per "
                    "night in New York, London, San Francisco and Tokyo.",
                ],
            ),
        ],
        [
            (
                "Equipment",
                [
                    "Every employee receives a MacBook Pro, which is refreshed every three years. "
                    "Engineers may request an additional external monitor through the IT portal.",
                    "Remote and hybrid employees receive a one-time home office stipend of 500 USD "
                    "and an internet allowance of 40 USD per month, paid through payroll.",
                ],
            ),
            (
                "Security Basics",
                [
                    "Report a lost or stolen device to IT within one hour at it@acme.example, so "
                    "the device can be locked and wiped. Never store customer data on personal "
                    "devices or personal cloud accounts.",
                    "All employees complete security awareness training when they join and every "
                    "year after that. Forward suspected phishing emails to phishing@acme.example "
                    "instead of clicking links in them.",
                ],
            ),
        ],
        [
            (
                "Learning and Growth",
                [
                    "Each employee has a learning budget of 1,500 USD per year for courses, books "
                    "and certifications. Conference trips are paid from the same budget, with "
                    "travel booked under the travel policy.",
                    "Performance reviews happen twice a year, in April and October. Each review "
                    "includes a self-assessment, peer feedback and a conversation with your "
                    "manager about goals for the next six months.",
                ],
            ),
            (
                "Code of Conduct",
                [
                    "Treat colleagues, customers and partners with respect. Harassment and "
                    "discrimination are not tolerated. Report concerns to your manager, to People "
                    "Operations, or anonymously through the ethics hotline at "
                    "ethics.acme.example. Acme does not allow retaliation against anyone who "
                    "reports a concern in good faith.",
                ],
            ),
        ],
    ],
}

SECURITY_WHITEPAPER = {
    "title": "Acme Security Whitepaper",
    "subtitle": "How Acme protects customer data, October 2026",
    "pages": [
        [
            (
                "Encryption",
                [
                    "Customer data is encrypted at rest with AES-256 and in transit with TLS 1.2 "
                    "or higher. Encryption keys are managed in AWS KMS and rotated every 90 days. "
                    "Strategic customers can bring their own key (BYOK), which they can revoke "
                    "at any time to make their data unreadable.",
                ],
            ),
            (
                "Certifications",
                [
                    "Acme holds a SOC 2 Type II report covering security, availability and "
                    "confidentiality, renewed every 12 months. Acme has been ISO/IEC 27001 "
                    "certified since 2025. Customers can request the latest SOC 2 report under "
                    "NDA through their account manager.",
                ],
            ),
        ],
        [
            (
                "Backups and Recovery",
                [
                    "Production databases are backed up every 6 hours and backups are kept for 35 "
                    "days. Backups are encrypted and stored in a second availability zone in the "
                    "same region as the customer data.",
                    "Acme's recovery point objective (RPO) is 6 hours and its recovery time "
                    "objective (RTO) is 4 hours. Disaster recovery is tested twice a year, and "
                    "the results are summarised in the SOC 2 report.",
                ],
            ),
            (
                "Testing",
                [
                    "An independent firm runs a penetration test of the platform every year. Acme "
                    "also runs a private bug bounty program and fixes critical findings within "
                    "7 days and high findings within 30 days.",
                ],
            ),
        ],
        [
            (
                "Employee Access",
                [
                    "Employees sign in with single sign-on and hardware security keys. Access to "
                    "production systems is granted just in time, expires after 8 hours, and is "
                    "logged for audit. Access reviews run every quarter.",
                ],
            ),
        ],
    ],
}

PRICING = {
    "title": "Acme Pricing and Plans 2026",
    "sections": [
        (
            "Plans",
            [
                "Starter costs 29 USD per user per month and supports up to 10 users. It includes "
                "email support and imports of up to 5 GB per month.",
                "Premium costs 79 USD per user per month with a minimum of 10 seats. It includes "
                "business-hours support, priority ticket routing, the secure import portal, "
                "single sign-on, and a 99.9 percent uptime commitment.",
                "Strategic is priced per contract, starting at 60,000 USD per year. It adds a "
                "named customer success manager, quarterly business reviews, expedited refund "
                "handling, EU data residency, and a 99.95 percent uptime commitment.",
            ],
        ),
        (
            "Discounts",
            [
                "Annual billing saves 15 percent compared with monthly billing. Registered "
                "nonprofits and schools receive 30 percent off Starter and Premium. Discounts do "
                "not stack; the larger discount applies.",
            ],
        ),
        (
            "Usage and Overages",
            [
                "Every plan includes 1 million API calls per month. Additional API calls cost "
                "0.40 USD per 1,000 calls. Storage above the plan allowance costs 0.10 USD per GB "
                "per month. Overages are billed monthly in arrears.",
            ],
        ),
        (
            "Add-ons",
            [
                "Advanced Analytics costs 12 USD per user per month. Audit Log Export costs 2,000 "
                "USD per year and is included in Strategic. A sandbox environment costs 500 USD "
                "per month.",
            ],
        ),
        (
            "Trials",
            [
                "Free trials last 14 days and include Premium features for up to 5 users. An "
                "account executive can extend a trial once, to a maximum of 30 days.",
            ],
        ),
    ],
}


def build_pdf(document: dict, path: Path) -> None:
    styles = getSampleStyleSheet()
    story = [
        Paragraph(document["title"], styles["Title"]),
        Paragraph(document["subtitle"], styles["Italic"]),
        Spacer(1, 0.2 * inch),
    ]
    for index, page in enumerate(document["pages"]):
        if index:
            story.append(PageBreak())
        for heading, body in page:
            if heading:
                story.append(Paragraph(heading, styles["Heading2"]))
            story.extend(Paragraph(paragraph, styles["BodyText"]) for paragraph in body)

    def footer(canvas, doc) -> None:
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(LETTER[0] - inch, 0.6 * inch, f"Page {doc.page}")

    path.parent.mkdir(parents=True, exist_ok=True)
    SimpleDocTemplate(str(path), pagesize=LETTER, title=document["title"]).build(
        story, onFirstPage=footer, onLaterPages=footer
    )


def build_docx(document: dict, path: Path) -> None:
    docx = Document()
    docx.add_heading(document["title"], level=0)
    for heading, body in document["sections"]:
        docx.add_heading(heading, level=1)
        for paragraph in body:
            docx.add_paragraph(paragraph)
    docx.save(str(path))


if __name__ == "__main__":
    build_pdf(MSA, ROOT / "docs/seed/acme_master_service_agreement.pdf")
    build_pdf(HANDBOOK, ROOT / "docs/seed/acme_employee_handbook.pdf")
    build_pdf(SECURITY_WHITEPAPER, ROOT / "docs/demo_upload/acme_security_whitepaper.pdf")
    build_docx(PRICING, ROOT / "docs/seed/acme_pricing_and_plans.docx")
    print("Built seed PDFs, the pricing DOCX and the demo upload PDF.")
