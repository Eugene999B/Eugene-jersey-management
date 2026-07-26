import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

const root = process.cwd();
const sourceDir = path.join(root, "docs", "source");
const wordDir = path.join(root, "docs", "word");

function safeFileName(name: string) {
  return name.replace(/\.md$/i, "").replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function inlineRuns(text: string) {
  const runs: TextRun[] = [];
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  for (const part of parts) {
    if (part.startsWith("`") && part.endsWith("`")) {
      runs.push(new TextRun({ text: part.slice(1, -1), font: "Consolas" }));
    } else if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
    } else {
      runs.push(new TextRun(part));
    }
  }
  return runs;
}

function markdownToParagraphs(markdown: string) {
  const paragraphs: Paragraph[] = [];
  let inCode = false;

  for (const rawLine of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: line || " ", font: "Consolas", size: 18 })], spacing: { after: 40 } }));
      continue;
    }
    if (!line.trim()) {
      paragraphs.push(new Paragraph({ text: "", spacing: { after: 80 } }));
      continue;
    }
    if (line.startsWith("### ")) {
      paragraphs.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
      continue;
    }
    if (line.startsWith("## ")) {
      paragraphs.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
      continue;
    }
    if (line.startsWith("# ")) {
      paragraphs.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.TITLE }));
      continue;
    }
    if (/^[-*] /.test(line)) {
      paragraphs.push(new Paragraph({ children: inlineRuns(line.slice(2)), bullet: { level: 0 } }));
      continue;
    }
    if (/^\d+\. /.test(line)) {
      paragraphs.push(new Paragraph({ children: inlineRuns(line.replace(/^\d+\. /, "")), numbering: { reference: "numbered-list", level: 0 } }));
      continue;
    }
    paragraphs.push(new Paragraph({ children: inlineRuns(line), spacing: { after: 120 } }));
  }

  return paragraphs;
}

async function generate() {
  await mkdir(wordDir, { recursive: true });
  const sourceFiles = (await readdir(sourceDir)).filter((name) => name.toLowerCase().endsWith(".md")).sort();
  if (!sourceFiles.length) throw new Error("No Markdown documentation files were found in docs/source.");

  for (const fileName of sourceFiles) {
    const markdown = await readFile(path.join(sourceDir, fileName), "utf8");
    const document = new Document({
      creator: "Eugene Jersey Management",
      title: markdown.match(/^#\s+(.+)$/m)?.[1] ?? safeFileName(fileName),
      numbering: {
        config: [{
          reference: "numbered-list",
          levels: [{ level: 0, format: "decimal", text: "%1.", alignment: "left", style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
        }],
      },
      sections: [{
        properties: {},
        children: markdownToParagraphs(markdown),
      }],
    });
    const outputPath = path.join(wordDir, `${safeFileName(fileName)}.docx`);
    await writeFile(outputPath, await Packer.toBuffer(document));
    console.log(`Generated ${path.relative(root, outputPath)}`);
  }
}

generate().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
