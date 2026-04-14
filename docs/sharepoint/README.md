# Centric Intake SharePoint Documentation Pack

This folder contains the SharePoint-ready documentation package for Centric Intake.

## Recommended Uploads

Upload the generated Word documents from `exports/`:

- `Centric-Intake-Product-Overview.docx`
- `Centric-Intake-Technical-Breakdown.docx`
- `Centric-Intake-Workflow-Diagrams.docx`
- `Centric-Intake-GitHub-README.docx`

If PDFs are required, upload the Word documents to SharePoint or open them in Microsoft Word and use `Export to PDF`. The local repository can generate the Word documents directly; PDF export depends on Microsoft Word, LibreOffice, or another PDF renderer being available on the machine.

## Source Files

The editable Markdown source files are:

- `Centric-Intake-Product-Overview.md`
- `Centric-Intake-Workflow-Diagrams.md`
- `../technical-breakdown.md`
- `../../README.md`

Regenerate the Word documents with:

```bash
./docs/sharepoint/build-docs.sh
```

## Suggested SharePoint Folder Structure

```text
Centric Intake Documentation/
  01 Product Overview/
    Centric-Intake-Product-Overview.docx

  02 Engineering Review/
    Centric-Intake-Technical-Breakdown.docx
    Centric-Intake-GitHub-README.docx

  03 Workflow Diagrams/
    Centric-Intake-Workflow-Diagrams.docx
    end-to-end-workflow.mmd
    generation-pipeline.mmd
    workflow-map.json
```

## How To Use These Documents

- Send the product overview first to product, marketing, and leadership readers.
- Send the technical breakdown to engineering after they understand the product intent.
- Send the workflow diagrams with either document when the conversation moves into process, handoff, or system ownership.
- Keep the Markdown files as the editable source and regenerate Word documents when the content changes.
