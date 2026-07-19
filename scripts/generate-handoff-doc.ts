import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

const root = process.cwd();
const sourcePath = path.join(root, "docs", "source", "09_ChatGPT_Project_Handoff_and_Deployment_Playbook.md");
const outputPath = path.join(root, "docs", "word", "09_ChatGPT_Project_Handoff_and_Deployment_Playbook.docx");

function paragraph(text: string) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function heading(text: string, level: typeof HeadingLevel.HEADING_1 | typeof HeadingLevel.TITLE) {
  return new Paragraph({
    heading: level,
    spacing: { before: 180, after: 120 },
    children: [new TextRun({ text, bold: true, size: level === HeadingLevel.TITLE ? 34 : 28 })],
  });
}

function bullet(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 21 })],
  });
}

function code(text: string) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [new TextRun({ text, font: "Consolas", size: 19 })],
  });
}

async function main() {
  const markdown = await readFile(sourcePath, "utf8");
  const children: Paragraph[] = [];
  let inCode = false;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      inCode = !inCode;
      continue;
    }

    if (!line.trim()) {
      continue;
    }

    if (inCode) {
      children.push(code(line));
    } else if (line.startsWith("# ")) {
      children.push(heading(line.replace(/^# /, ""), HeadingLevel.TITLE));
    } else if (line.startsWith("## ")) {
      children.push(heading(line.replace(/^## /, ""), HeadingLevel.HEADING_1));
    } else if (line.startsWith("- ")) {
      children.push(bullet(line.replace(/^- /, "")));
    } else {
      children.push(paragraph(line));
    }
  }

  const document = new Document({
    creator: "Codex",
    title: "Sports Shop Platform - ChatGPT Project Handoff and Deployment Playbook",
    sections: [{ children }],
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, await Packer.toBuffer(document));
  console.log(`Generated ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
